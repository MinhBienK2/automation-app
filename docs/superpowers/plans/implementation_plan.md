# Fix Workflow Save Performance — Autosave & Manual Save Nhanh Như Nhau

## Mục tiêu

Hiện tại save workflow graph chậm vì:
1. INSERT tuần tự từng node/edge (~100 round-trips tới PostgreSQL remote)
2. Manual save (nút Save) chậm hơn autosave vì phải `await loadWorkflows()` sau save
3. Mỗi lần save đều tạo revision snapshot (thêm 2 queries)

**Kết quả mong muốn**: Cả autosave và manual save đều nhanh, giảm từ ~100+ SQL queries xuống ~4-6 queries mỗi lần save.

---

## Proposed Changes

### Component 1: Backend — Batch INSERT nodes/edges

> [!IMPORTANT]
> Đây là thay đổi quan trọng nhất, giảm ~100 round-trips xuống 2 (1 cho nodes, 1 cho edges).

#### [MODIFY] [backfillGraphTables.ts](file:///home/minhbien/Documents/automation_app/electron/backend/persistence/backfillGraphTables.ts)

**Thay đổi `decomposeAndInsert`**: Chuyển từ INSERT từng row sang multi-row INSERT.

Hiện tại (chậm):
```typescript
for (let i = 0; i < graph.nodes.length; i++) {
  await db.execute(`INSERT INTO ${nodeTable} ...`, [...]);
}
```

Sẽ chuyển thành (nhanh):
```typescript
// Batch insert all nodes in one query
if (graph.nodes.length > 0) {
  const placeholders = graph.nodes.map((_, i) => {
    const base = i * 14;
    return `($${base+1}, $${base+2}, ..., $${base+14})`;
  }).join(', ');
  const values = graph.nodes.flatMap((node, i) => {
    const meta = extractNodeMeta(node);
    return [node.id, ownerId, node.node_type, meta.action_type, ...];
  });
  await db.execute(`INSERT INTO ${nodeTable} (...) VALUES ${placeholders}`, values);
}
```

Tương tự cho edges — batch thành 1 query duy nhất.

**Xử lý edge case**: PostgreSQL có giới hạn ~34,464 params. Mỗi node cần 14 params → hỗ trợ tối đa ~2,461 nodes/batch. Nếu graph vượt quá (rất hiếm), chia thành chunks.

---

### Component 2: Frontend — Thống nhất Manual Save = Autosave (cùng tốc độ)

> [!IMPORTANT]
> Manual save hiện dùng `persistCurrentGraph()` (có `await loadWorkflows()`), còn autosave gọi trực tiếp `saveWorkflowGraph()` (không `loadWorkflows()`). Cần làm cho cả hai đều nhanh như nhau.

#### [MODIFY] [useWorkflowGraphState.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/state/useWorkflowGraphState.ts)

Trong `persistCurrentGraph()` (line 109): Chuyển `await loadWorkflows()` thành **fire-and-forget** (`void loadWorkflows()`). 

`loadWorkflows()` chỉ cập nhật `updated_at` trên danh sách workflow — user đang ở detail page nên không cần block UI vì thông tin này.

```diff
       await saveWorkflowGraph(detail.workflow.id, workflowGraph, options);
       setSavedGraphRevision(graphRevisionRef.current);
       savedGraphRevisionRef.current = graphRevisionRef.current;
       setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
-      await loadWorkflows();
+      void loadWorkflows();
       return true;
```

#### [MODIFY] [useWorkflowSettingsState.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/state/useWorkflowSettingsState.ts)

Trong `persistWorkflowSettingsSection()` (line 165): Tương tự, chuyển `await loadWorkflows()` thành fire-and-forget.

```diff
       setWorkflowSettingsSaveStatuses((current) => ({
         ...current,
         [section]: "saved",
       }));
-      await loadWorkflows();
+      void loadWorkflows();
       return true;
```

---

### Component 3: Backend — Skip Revision Snapshot Cho Autosave

> [!NOTE]  
> Mỗi lần autosave tạo 1 revision snapshot (SELECT MAX + INSERT vào `workflow_revisions`). Với autosave mỗi 1 giây, đây là overhead không cần thiết. Chỉ nên tạo revision khi user save thủ công hoặc khi có `comment`/`tag`.

#### [MODIFY] [workflowRepository.ts](file:///home/minhbien/Documents/automation_app/electron/backend/persistence/workflowRepository.ts)

Thêm option `skipRevision` vào `saveWorkflowGraph`:

```diff
   async saveWorkflowGraph(
     id: string,
     graph: WorkflowGraph,
-    options: { comment?: string | null; tag?: string | null } = {},
+    options: { comment?: string | null; tag?: string | null; skipRevision?: boolean } = {},
     now = new Date(),
   ): Promise<void> {
     const timestamp = now.toISOString();
     await this.database.execute(
       "UPDATE workflows SET updated_at = $1 WHERE id = $2 AND owner_id = $3",
       [timestamp, id, this.database.ownerId],
     );
     await writeGraphToNormalizedTables(this.database, graph, "workflow", id, timestamp);
-    await snapshotRevision(this.database, "workflow", id, graph, {
-      createdAt: timestamp,
-      comment: options.comment,
-      tag: options.tag,
-    });
+    if (!options.skipRevision) {
+      await snapshotRevision(this.database, "workflow", id, graph, {
+        createdAt: timestamp,
+        comment: options.comment,
+        tag: options.tag,
+      });
+    }
   }
```

#### [MODIFY] [subflowRepository.ts](file:///home/minhbien/Documents/automation_app/electron/backend/persistence/subflowRepository.ts)

Tương tự, thêm `skipRevision` option cho subflow:

```diff
   async saveSubflowGraph(
     subflowId: string,
     graph: WorkflowGraph,
-    options: { comment?: string | null; tag?: string | null } = {},
+    options: { comment?: string | null; tag?: string | null; skipRevision?: boolean } = {},
     now = new Date(),
   ): Promise<void> {
     ...
-    await snapshotRevision(this.database, "subflow", subflowId, graph, {
-      createdAt: timestamp,
-      comment: options.comment,
-      tag: options.tag,
-    });
+    if (!options.skipRevision) {
+      await snapshotRevision(this.database, "subflow", subflowId, graph, {
+        createdAt: timestamp,
+        comment: options.comment,
+        tag: options.tag,
+      });
+    }
   }
```

#### [MODIFY] [workflowCommands.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/workflowCommands.ts)

Truyền `skipRevision` từ frontend:

```diff
     async saveWorkflowGraph(
       workflowId: string,
       graph: WorkflowGraph,
-      options?: { comment?: string; tag?: string },
+      options?: { comment?: string; tag?: string; skipRevision?: boolean },
     ) {
       await requireWorkflow(workflowId);
       const migrated = migrateWorkflowGraph(graph);
       assertNoUnsupportedGraphDiscriminants(migrated);
       await repository.saveWorkflowGraph(workflowId, migrated, options);
     },
```

#### [MODIFY] [App.tsx](file:///home/minhbien/Documents/automation_app/src/App.tsx)

Autosave effect truyền `skipRevision: true` (line 487):

```diff
         const currentGraph = workflowGraphRef.current;
         if (currentGraph) {
-            await saveWorkflowGraph(workflowId, currentGraph);
+            await saveWorkflowGraph(workflowId, currentGraph, { skipRevision: true });
         }
```

#### [MODIFY] [workflowApi.ts](file:///home/minhbien/Documents/automation_app/src/lib/workflowApi.ts)

Đảm bảo `saveWorkflowGraph` truyền đúng options (bao gồm `skipRevision`):

```diff
 export function saveWorkflowGraph(
   workflowId: string,
   graph: WorkflowGraph,
-  options?: { comment?: string; tag?: string },
+  options?: { comment?: string; tag?: string; skipRevision?: boolean },
 ) {
-  return bridge().saveWorkflowGraph(workflowId, cleanForIpc(graph), cleanOptionsForIpc(options));
+  return bridge().saveWorkflowGraph(workflowId, cleanForIpc(graph), cleanSaveOptionsForIpc(options));
 }
```

Thêm helper mới `cleanSaveOptionsForIpc` (giữ nguyên `cleanOptionsForIpc` cho backward compat):

```typescript
function cleanSaveOptionsForIpc(options?: { comment?: string; tag?: string; skipRevision?: boolean }) {
  if (!options || typeof options !== "object" || "nativeEvent" in options) {
    return undefined;
  }
  return {
    comment: options.comment,
    tag: options.tag,
    skipRevision: options.skipRevision,
  };
}
```

#### [MODIFY] IPC preload — [preload.cts](file:///home/minhbien/Documents/automation_app/electron/preload.cts)

Đảm bảo options được pass-through (hiện đã pass, chỉ cần verify type).

---

### Component 4: Cleanup — Xóa debug console.log

#### [MODIFY] [WorkflowDetailPage.tsx](file:///home/minhbien/Documents/automation_app/src/features/workflows/pages/WorkflowDetailPage.tsx)

Xóa dòng debug log (line 99):

```diff
-  console.log("DEBUG: WorkflowDetailPage rendering", { isRunning, isSavingGraph });
```

---

## Tóm tắt thay đổi số queries

| | Trước | Sau |
|---|---|---|
| DELETE nodes + edges | 2 | 2 |
| INSERT nodes | N (1/node) | 1 (batch) |
| INSERT edges | M (1/edge) | 1 (batch) |
| UPDATE meta (workflows) | 2 | 2 |
| Revision snapshot (autosave) | 2 (SELECT MAX + INSERT) | 0 (skipped) |
| Revision snapshot (manual) | 2 | 2 |
| loadWorkflows() | 1 (blocking, manual only) | 1 (fire-and-forget) |
| **Tổng (autosave, 50 nodes)** | **~104** | **~6** |
| **Tổng (manual save, 50 nodes)** | **~105** | **~8** |

---

## Verification Plan

### Automated Tests

```bash
# Unit tests cho batch insert
rtk npm run test electron/backend/persistence/backfillGraphTables.test.ts

# Unit tests cho workflow commands (verify skipRevision)
rtk npm run test electron/backend/commands/workflowCommands.test.ts

# Unit tests cho revision repository
rtk npm run test electron/backend/persistence/revisionRepository.test.ts

# Frontend autosave tests
rtk npm run test src/App.test.tsx

# Frontend graph state tests
rtk npm run test src/features/workflows/state

# Full test suite
rtk npm run test
```

### Manual Verification

- Mở workflow detail với graph lớn (30+ nodes)
- Thay đổi 1 node → observe autosave spinner hết nhanh
- Nhấn nút Save → observe spinner hết nhanh (tương đương autosave)
- Mở Settings → Save settings → observe spinner hết nhanh
- Verify revision history vẫn hoạt động (manual save tạo revision, autosave thì không)
