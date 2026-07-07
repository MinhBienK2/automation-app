# Design Spec - Granular List / Array Processing Nodes

This document specifies the design for adding a new dedicated **"List"** category in the "Add Variable Node" popup. Within this category, list-related operations are split into 16 new highly-specific single-purpose nodes (organized under 4 sub-sections), complementing the existing list manipulation capabilities of the workflow engine.

---

## Proposed Category Hierarchy

In the "Add Variable Node" popup sidebar, the following sub-categories will be rendered under the **List** namespace:
1. **List: Create** (Create/initialize arrays)
2. **List: Update** (Mutate existing arrays in-place)
3. **List: Process** (Read, slice, transform, or run scripts on arrays)
4. **List: Conditions** (Validate array state and return booleans)

---

## Node Definitions & Specifications

### 1. Sub-Category: List: Create

#### A. `create_empty_list` (Tạo mảng rỗng)
* **Purpose**: Initialize an empty array `[]` in memory.
* **Config Fields**:
  * `output_name` (string): Tên biến mảng đầu ra.
* **Backend Execution**:
  ```typescript
  runtime.outputs[output_name] = [];
  ```

#### B. `create_list_manual` (Tạo mảng thủ công)
* **Purpose**: Create a list from user-supplied values (one per line).
* **Config Fields**:
  * `output_name` (string): Tên biến mảng đầu ra.
  * `value_type` (enum): Kiểu dữ liệu (`text` | `json` | `number` | `boolean`).
  * `items` (textarea): Dữ liệu phần tử, phân tách bằng dấu xuống dòng.
* **Backend Execution**:
  * Parse lines from `items` and convert them into the selected `value_type`.
  * Store the resulting array into `runtime.outputs[output_name]`.

#### C. `split_text_to_list` (Tách chuỗi thành mảng)
* **Purpose**: Convert a delimited string into an array.
* **Config Fields**:
  * `output_name` (string): Tên biến mảng đầu ra.
  * `source_text` (string): Văn bản nguồn (chấp nhận template `{{var}}`).
  * `delimiter` (string): Ký tự phân tách (ví dụ: `,`, `;`, `\n`).
* **Backend Execution**:
  ```typescript
  const text = renderTemplate(source_text, runtime.outputs);
  runtime.outputs[output_name] = text.split(delimiter);
  ```

#### D. `generate_number_range` (Tạo dãy số tự động)
* **Purpose**: Generate a list of integers from `start` to `end` with a step size.
* **Config Fields**:
  * `output_name` (string): Tên biến mảng đầu ra.
  * `start` (string/number): Điểm bắt đầu (hỗ trợ template).
  * `end` (string/number): Điểm kết thúc (hỗ trợ template).
  * `step` (string/number): Bước nhảy (mặc định: 1, hỗ trợ template).
* **Backend Execution**:
  * Evaluate `start`, `end`, and `step`. Generates sequence `[start, start+step, ...]` up to `end`.

---

### 2. Sub-Category: List: Update

#### A. `add_to_list` (Thêm phần tử vào mảng)
* **Purpose**: Add an item to the beginning, end, or uniquely to an existing array.
* **Config Fields**:
  * `name` (string): Tên biến mảng đích.
  * `position` (enum): `end` (Push) | `start` (Unshift) | `unique_end` (Push Unique).
  * `value_type` (enum): `text` | `json` | `number` | `boolean`.
  * `value` (string): Giá trị thêm vào.
* **Backend Execution**:
  * Append/prepend item. If `unique_end` is selected, perform deep object equality check before pushing.

#### B. `remove_from_list_by_index` (Xóa theo vị trí index)
* **Purpose**: Remove an item at a specific 0-based index.
* **Config Fields**:
  * `name` (string): Tên biến mảng.
  * `index` (string/number): Vị trí index cần xóa (hỗ trợ template/biến).
* **Backend Execution**:
  ```typescript
  const idx = Number(renderTemplate(index, runtime.outputs));
  if (!Number.isNaN(idx)) {
    array.splice(idx, 1);
  }
  ```

#### C. `remove_from_list_by_value` (Xóa theo giá trị)
* **Purpose**: Remove all items matching a specific value.
* **Config Fields**:
  * `name` (string): Tên biến mảng.
  * `value_type` (enum): `text` | `json` | `number` | `boolean`.
  * `value` (string): Giá trị cần khớp và xóa (hỗ trợ template).
* **Backend Execution**:
  * Filter out elements that equal `value` (deep check for JSON objects).

#### D. `merge_lists` (Gộp mảng)
* **Purpose**: Merge another array or range of elements into the target array.
* **Config Fields**:
  * `name` (string): Tên biến mảng đích.
  * `value` (string): Tên biến mảng nguồn hoặc chuỗi JSON mảng cần gộp.
  * `unique` (boolean): Chỉ gộp phần tử chưa tồn tại (`true`/`false`).
* **Backend Execution**:
  * Resolve array from value and append to target. If `unique` is true, perform uniqueness checks on insertion.

---

### 3. Sub-Category: List: Process

#### A. `get_list_item` (Lấy phần tử trong mảng)
* **Purpose**: Retrieve a single item by position.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `position` (enum): `first` | `last` | `index`.
  * `index` (string/number): Vị trí chỉ định (chỉ hiện khi chọn `index`).
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  * Evaluates position and stores selected item into `runtime.outputs[output_name]`.

#### B. `get_list_length` (Lấy độ dài mảng)
* **Purpose**: Retrieve the count of items in the list.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  ```typescript
  runtime.outputs[output_name] = array.length;
  ```

#### C. `slice_list` (Cắt mảng)
* **Purpose**: Extract a subset of elements.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `start` (string/number): Vị trí bắt đầu (mặc định: 0).
  * `end` (string/number): Vị trí kết thúc (không bắt buộc).
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  ```typescript
  runtime.outputs[output_name] = array.slice(start, end);
  ```

#### D. `join_list` (Gộp mảng thành chuỗi văn bản)
* **Purpose**: Join elements into a single string.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `separator` (string): Chuỗi phân cách (ví dụ: `, `).
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  ```typescript
  runtime.outputs[output_name] = array.join(separator);
  ```

#### E. `filter_list` (Lọc phần tử trong mảng)
* **Purpose**: Filter array items visually based on logical conditions.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `rules_group` (LogicRuleGroup): Trình dựng điều kiện logic.
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  * Iterates and evaluates rules for each array element, storing the filtered array.

#### F. `map_list_property` (Bóc tách thuộc tính từ mảng object)
* **Purpose**: Map array of JSON objects to an array of specific keys (properties).
* **Config Fields**:
  * `source` (string): Tên biến mảng chứa đối tượng.
  * `property_key` (string): Thuộc tính cần bóc (ví dụ: `id` hoặc `email`).
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  ```typescript
  runtime.outputs[output_name] = array.map(item => item && item[property_key]);
  ```

#### G. `sort_reverse_list` (Sắp xếp / Đảo ngược mảng)
* **Purpose**: Sort ascending/descending or reverse order.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `action` (enum): `sort_asc` | `sort_desc` | `reverse`.
  * `sort_key` (string): Tên trường để sắp xếp (không bắt buộc, dành cho mảng objects).
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  * Sort or reverse elements.

#### H. `execute_list_script` (Chạy JS chuyên biệt cho mảng)
* **Purpose**: Run custom Javascript directly processing the list.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `script` (textarea): Code JS (mảng đầu vào tự động được gán thành tham số `list`).
  * `output_name` (string): Tên biến nhận kết quả.
* **Backend Execution**:
  * Execute code in browser sandbox passing `list` as variable:
    ```javascript
    const result = await page.evaluate(({ scriptText, list }) => {
      const fn = new Function("list", `return (${scriptText});`);
      return fn(list);
    }, { scriptText, list: array });
    runtime.outputs[output_name] = result;
    ```

---

### 4. Sub-Category: List: Conditions

#### A. `check_list_empty` (Kiểm tra mảng rỗng)
* **Purpose**: Verify if the list is empty.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `output_name` (string): Tên biến nhận kết quả (`true`/`false`).
* **Backend Execution**:
  ```typescript
  runtime.outputs[output_name] = array.length === 0;
  ```

#### B. `check_list_contains` (Kiểm tra mảng chứa giá trị)
* **Purpose**: Verify if an item exists in the array.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `value_type` (enum): `text` | `json` | `number` | `boolean`.
  * `value` (string): Giá trị cần khớp.
  * `output_name` (string): Tên biến nhận kết quả (`true`/`false`).
* **Backend Execution**:
  * Returns true if value is found (deep equality check for JSON elements).

#### C. `check_list_any_match` (Kiểm tra ít nhất một phần tử khớp)
* **Purpose**: Verify if `some` item satisfies logical rules.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `rules_group` (LogicRuleGroup): Trình dựng điều kiện logic.
  * `output_name` (string): Tên biến nhận kết quả (`true`/`false`).
* **Backend Execution**:
  * Evaluates rules against items. Returns `true` if at least one item evaluates to `true`.

#### D. `check_list_all_match` (Kiểm tra tất cả phần tử khớp)
* **Purpose**: Verify if `every` item satisfies logical rules.
* **Config Fields**:
  * `source` (string): Tên biến mảng.
  * `rules_group` (LogicRuleGroup): Trình dựng điều kiện logic.
  * `output_name` (string): Tên biến nhận kết quả (`true`/`false`).
* **Backend Execution**:
  * Evaluates rules against items. Returns `true` if all items evaluate to `true`.

---

## Technical Implementations

1. **Action Config Types & Schemas**:
   - Define type configurations in [workflowCore.ts](file:///home/minhbien/Documents/automation_app/src/types/workflowCore.ts).
   - Create Zod validation schemas in `electron/backend/actions/schemas/` for each new action.
2. **Runner Executor Mapping**:
   - Map executions in [runnerActionExecutors.ts](file:///home/minhbien/Documents/automation_app/electron/backend/runtime/runnerActionExecutors.ts).
3. **Inspector Layout**:
   - Render configurations inside `WorkflowGraphInspectorFields.tsx` using customized form inputs.
4. **Palettes Reorganization**:
   - Update `WorkflowGraphPalettes.tsx` to export new groups structure under `variableNodeGroups`:
     ```typescript
     export const variableNodeGroups = [
       { label: "Variables (General)", nodes: ["set_variable", "set_json_variables", "check_conditions", "calculate_value", "update_number_variable", "update_text_variable", "update_flag_variable", "update_object_variable"] },
       { label: "List: Create", nodes: ["create_empty_list", "create_list_manual", "split_text_to_list", "generate_number_range"] },
       { label: "List: Update", nodes: ["add_to_list", "remove_from_list_by_index", "remove_from_list_by_value", "merge_lists"] },
       { label: "List: Process", nodes: ["get_list_item", "get_list_length", "slice_list", "join_list", "filter_list", "map_list_property", "sort_reverse_list", "execute_list_script"] },
       { label: "List: Conditions", nodes: ["check_list_empty", "check_list_contains", "check_list_any_match", "check_list_all_match"] }
     ];
     ```

---

## Verification Plan

### Automated Tests
- Run `rtk npm run test` to verify zero regressions.
- Add focused test cases in `runnerActionExecutors.test.ts` for all 16 new nodes.

### Manual Verification
1. Open the Workflow Detail Page.
2. Click **Add Variable Node**. Verify the new categories slide in: `List: Create`, `List: Update`, `List: Process`, `List: Conditions`.
3. Add a list creation node (`create_list_manual`) and verification nodes. Run the workflow and verify outputs in the Variables Drawer.
