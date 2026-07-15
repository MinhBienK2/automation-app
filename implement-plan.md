# Master Plan: Isolated Desktop App Automation Mode

Tài liệu này là bản kế hoạch tổng thể (Master Plan) tích hợp chế độ **Desktop App Automation** sử dụng **CUA Driver**, tuân thủ nghiêm ngặt nguyên tắc **cô lập hoàn toàn mã nguồn (Complete Code Isolation)** và **phân tách luồng UI/UX rõ ràng** giữa Web Browser và Desktop App.

---

## 1. Thiết kế UI/UX & Luồng Điều Hướng (Grouped Navigation)

Giao diện chi tiết dự án (Project Detail) sẽ được tổ chức theo cấu trúc **Left Sidebar Grouped Navigation** để phân tách hoàn toàn hai phân hệ:

```
+-------------------------------------------------------------------------------+
|  MY PROJECT: staging-abuse-lab                                                |
|                                                                               |
|  [ Sidebar Navigation ]            [ Active Workspace Content Area ]          |
|                                                                               |
|  🌐 WEB BROWSER                                                               |
|     ├─ Workflows (05)    =======>  Mở <WorkflowListPage> (chỉ có Web flow)    |
|     ├─ Subflows (02)     =======>  Mở <SubflowListPage> (chỉ có Web subflow)  |
|     └─ Browser Profiles  =======>  Mở <ProjectProfilesPanel>                  |
|     └─ Settings  =======>  Mở web setting                  |
|                                                                               |
|  🖥️ DESKTOP APP                                                                |
|     ├─ Workflows (02)    =======>  Mở <DesktopWorkflowListPage>              |
|     └─ Subflows (01)     =======>  Mở <DesktopSubflowListPage>               |
|     └─ Settings (01)     =======>  Mở desktopSetting               |
|                                                                               |
|  ⚙️ PROJECT SETTINGS                                                           |
|     └─ Settings          =======>  Mở <ProjectSettings>                       |
+-------------------------------------------------------------------------------+
```

### Nguyên tắc UI/UX:
*   Mỗi nút bấm điều hướng mở ra một **component Page hoàn toàn độc lập**.
*   **Web Workflow List & Editor**: Chuyên biệt cho Browser.
*   **Desktop Workflow List & Editor**: Chuyên biệt cho Native Desktop App.
*   Không có code dùng chung lồng `if (mode === 'web') else` trong các trang chi tiết.

---

## 2. Tổ chức Thư mục Mã nguồn Cô lập

Chúng ta cách ly mã nguồn ở cả hai phân hệ để dễ dàng kiểm soát và bảo trì:

### 2.1. Backend (Electron Main Process)

```
electron/backend/
├── runtime/
│   └── runManager.ts             # Nhận diện mode và giao tiếp trực tiếp với Runner tương ứng
│
├── web/                          # [CÔ LẬP TOÀN BỘ WEB BACKEND]
│   ├── BrowserWorkflowRunner.ts  # Thực thi Web Graph
│   ├── BrowserActionExecutors.ts # Các Action Executor của Web (Click, Navigate...)
│   ├── BrowserSessionManager.ts  # Quản lý Chrome / Camoufox
│   └── subflow/
│       └── WebSubflowService.ts  # Logic subflow cho Web
│
└── desktop/                      # [CÔ LẬP TOÀN BỘ DESKTOP BACKEND]
    ├── CuaDriverClient.ts        # Client giao tiếp stdio MCP tới CUA Driver
    ├── DesktopWorkflowRunner.ts  # Thực thi Desktop Graph (Dưới 500 lines)
    ├── DesktopActionExecutors.ts # Các Action Executor của Desktop (Click, Keypress...)
    └── subflow/
        └── DesktopSubflowService.ts # Logic subflow cho Desktop
```

### 2.2. Frontend (React UI)

```
src/features/
├── web-browser/                  # [CHỈ LIÊN QUAN ĐẾN WEB BROWSER]
│   ├── workflows/                # Web Workflows (List, Editor, Hooks)
│   ├── subflows/                 # Web Subflows (List, Detail)
│   └── profiles/                 # Browser Profiles management
│
├── desktop-app/                  # [CHỈ LIÊN QUAN ĐẾN DESKTOP APP]
│   ├── workflows/                # Desktop Workflows (List, Editor, Hooks, Settings)
│   └── subflows/                 # Desktop Subflows (List, Detail)
│
└── projects/                     # Project shell & Grouped Navigation
    └── pages/
        └── ProjectsPage.tsx      # Sidebar phân nhóm Web Browser & Desktop App
```

---

## 3. Cấu trúc Cài đặt & Tách biệt Cấu hình (Settings Taxonomy)

Chúng ta phân chia cấu trúc cài đặt (Settings) thành **3 nhóm rõ ràng**:
1.  **Cài đặt chung (Common Settings)**: Áp dụng cho cả Web và Desktop.
2.  **Cài đặt Web (Web-Specific Settings)**: Chỉ xuất hiện khi ở phân hệ Web.
3.  **Cài đặt Desktop (Desktop-Specific Settings)**: Chỉ xuất hiện khi ở phân hệ Desktop.

### 3.1. Dữ liệu cài đặt (Types)

```typescript
// 1. Cài đặt chung (Common)
export type WorkflowSettingsGeneral = {
  name: string;
  description: string;
  tags: string[];
  notes: string;
};
export type WorkflowSettingsEnvironment = {
  initial_variables: VariableAssignment[];
};
export type WorkflowSettingsCommonRunPolicy = {
  max_workflow_duration_ms?: number | null;
  batch_concurrency_limit?: number | null;
  batch_stop_on_first_failed_row: boolean;
};

// 2. Cài đặt Web-Specific (Chỉ dành cho Web)
export type WorkflowSettingsWebRunPolicy = {
  browser_retention: "retain" | "close";
  execute_js_enabled: boolean;
};
export type WorkflowSettingsBrowserLaunch = {
  session_mode: "temporary" | "persistent_profile";
  identity_id: string;
  persona_id: string;
  proxy_enabled: boolean;
  headless: boolean;
  humanize: boolean;
  // ... các config browser fingerprinting hiện tại
};

// 3. Cài đặt Desktop-Specific (Chỉ dành cho Desktop App)
export type WorkflowSettingsDesktopLaunch = {
  app_executable_path: string;       // Đường dẫn file thực thi (.app, .exe, binary)
  app_arguments: string[];            // Đối số dòng lệnh khi khởi chạy ứng dụng
  cua_driver_mode: "local" | "remote"; // Chạy driver local hay qua VM/SSH
  cua_server_url?: string | null;     // Endpoint kết nối từ xa
  window_width?: number | null;
  window_height?: number | null;
};
```

### 3.2. Dialog cấu hình riêng biệt (UI Component Isolation)
Để tránh code lồng `if-else` phức tạp trong cùng một file, chúng ta tách ra **2 Dialog cài đặt độc lập**:
*   **`WebSettingsDialog.tsx`**: Chỉ hiển thị các trường cấu hình Web (General, Web Run Policy, Browser Launch, Environment).
*   **`DesktopSettingsDialog.tsx`**: Chỉ hiển thị các trường cấu hình Desktop (General, Common Run Policy, App Launch, Environment).

---

## 4. Các bước thực hiện chi tiết

### Phase 1: Database & Core Types
*   **Database Migration**: 
    *   Tạo file migration `003_add_automation_mode.ts` hỗ trợ đồng thời cả **PostgreSQL** và **SQLite**:
        *   *Postgres*: `ALTER TABLE workflows/subflows ADD COLUMN IF NOT EXISTS automation_mode VARCHAR(50) NOT NULL DEFAULT 'web';`
        *   *SQLite*: `ALTER TABLE workflows/subflows ADD COLUMN automation_mode TEXT NOT NULL DEFAULT 'web';`
    *   Đăng ký migration này trong [migrations.ts](file:///home/minhbien/Documents/automation_app/electron/backend/db/migrations/migrations.ts).
*   **Repository Update**: Cập nhật cả `workflowRepository.ts` và `subflowRepository.ts` để đọc/ghi cột `automation_mode` khi CRUD dữ liệu.
*   **Core Types & State Contracts**:
    *   Cập nhật [workflowCore.ts](file:///home/minhbien/Documents/automation_app/src/types/workflowCore.ts) để định nghĩa kiểu dữ liệu `automation_mode` và các settings mới.
    *   Cập nhật kiểu `ProjectCollection` và interface `ProjectWorkspaceAPI` trong [workspaceContracts.ts](file:///home/minhbien/Documents/automation_app/src/shared/types/workspaceContracts.ts) hỗ trợ các tab mới (`desktop_workflows`, `desktop_subflows`, `desktop_settings`, v.v.).
    *   Cập nhật hook [useProjectWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/projects/state/useProjectWorkspace.ts) để quản lý trạng thái chuyển đổi tab phù hợp.

### Phase 2: Backend Runners & Drivers
*   **CUA Driver Client (`CuaDriverClient.ts`)**: 
    *   Xây dựng module kết nối stdio MCP (JSON-RPC 2.0) với `cua-driver` daemon.
    *   **Quản lý vòng đời**: Đăng ký xử lý tắt tiến trình con (`cua-driver` child process) khi Electron tắt (`will-quit`) hoặc khi chạy bị hủy bỏ (Abort) để tránh tạo zombie process.
*   **Desktop Action Executors (`DesktopActionExecutors.ts`)**: Thực thi các lệnh của Desktop (`desktop_launch_app`, `click`, `type_text`, `press_key`, `hotkey`, `screenshot`, `scroll`).
*   **Desktop Runner (`DesktopWorkflowRunner.ts`)**: 
    *   Bộ chạy độc lập dành riêng cho Desktop App.
    *   **Phân giải biến số**: Phải gọi [resolveObjectTemplates](file:///home/minhbien/Documents/automation_app/electron/backend/runtime/variables.ts) trên cấu hình node trước khi thực thi nhằm hỗ trợ các thẻ token `{{variable_name}}`.
*   **Run Route Manager (`runManager.ts`)**: Đọc mode và định tuyến chạy Web Runner hoặc Desktop Runner.

### Phase 3: Frontend Layout & Navigation
*   **Grouped Navigation (`ProjectsPage.tsx`)**: Tách biệt Sidebar chi tiết project thành 2 nhóm **Web Browser** và **Desktop App**.
    *   *Lưu ý*: Kiểm tra và cập nhật các kiểm thử CSS liên quan đến `.project-collection-tabs` và `.project-collection-item` trong [AppCss.test.ts](file:///home/minhbien/Documents/automation_app/src/AppCss.test.ts) để tránh lỗi test khi thay đổi cấu trúc CSS.
*   **Desktop Workflows Pages (`DesktopWorkflowListPage.tsx`, `DesktopWorkflowDetailPage.tsx`)**: Trang danh sách và editor riêng cho Desktop.
*   **Desktop Actions Palette (`DesktopActionNodePalette.tsx`)**: Danh sách node kéo thả chỉ bao gồm các tương tác desktop.

---

## Verification Plan

### Automated Tests
*   **Linting**: Kiểm tra mã nguồn: `rtk npm run lint`
*   **Unit Tests chung**: Chạy unit tests toàn dự án: `rtk npm run test`
*   **Unit Tests mới**:
    *   Kiểm tra định tuyến chính xác trong `runManager.test.ts`.
    *   Kiểm tra mock stdio JSON-RPC trong `CuaDriverClient.test.ts`.
    *   Verify tương thích CSS trong `AppCss.test.ts`.

### Manual Verification
1. Mở Project -> Verify menu phân nhánh chính xác Web Browser và Desktop App.
2. Thử nghiệm tạo mới và biên tập:
   - Web Workflow -> Mở Web Editor, kiểm tra cấu hình Web Settings.
   - Desktop Workflow -> Mở Desktop Editor, kiểm tra cấu hình Desktop Settings.
3. Chạy thử và đối chiếu logs, screenshot hiển thị chính xác trong Run Monitor Drawer.

