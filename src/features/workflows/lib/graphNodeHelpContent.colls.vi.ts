import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const collNodesVi: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  update_list_variable: {
    title: "Trợ giúp Cập nhật Danh sách (Update List)",
    summary: "Thao tác trực tiếp với biến danh sách (mảng) hiện có.",
    useWhen: ["Dùng để thêm, xóa phần tử, gộp mảng hoặc lọc bỏ phần tử trùng lặp."],
    fields: [
      { name: "Variable name", description: "Tên biến danh sách cần cập nhật.", details: [] },
      { name: "Operation", description: "Thao tác mảng (push: thêm cuối, unshift: thêm đầu, pop: xóa cuối, shift: xóa đầu, merge: gộp danh sách, v.v.).", details: [] },
      { name: "Value type", description: "Kiểu dữ liệu của phần tử mới cần thêm.", details: [] },
      { name: "Value", description: "Giá trị của phần tử cần thao tác.", details: [] },
      { name: "Index", description: "Vị trí chỉ mục của phần tử cần xóa (khi dùng remove_by_index).", details: [] }
    ],
    examples: ["Variable: pending_urls, Operation: push, Value type: Text, Value: {{current_url}}"],
    commonMistakes: ["Thao tác trên một biến không phải là kiểu danh sách (array), dẫn đến lỗi runtime."],
  },
  create_empty_list: {
    title: "Trợ giúp Tạo Danh sách Rỗng (Create Empty List)",
    summary: "Khởi tạo một biến danh sách rỗng (mảng trống).",
    useWhen: ["Dùng để dọn sạch hoặc chuẩn bị mảng trống trước khi thực hiện các phép thêm phần tử (push) trong vòng lặp."],
    fields: [
      { name: "Output variable name", description: "Tên biến danh sách mới cần tạo.", details: [] }
    ],
    examples: ["Output variable name: harvested_emails"],
    commonMistakes: ["Để trống tên biến đầu ra, khiến workflow không thể lưu trữ kết quả."],
  },
  create_list_manual: {
    title: "Trợ giúp Tạo Danh sách Thủ công (Create List Manual)",
    summary: "Khởi tạo một danh sách với các giá trị tĩnh được cấu hình sẵn.",
    useWhen: ["Dùng khi cần duyệt qua một tập hợp các giá trị cố định (ví dụ: danh sách tên miền cần kiểm tra, danh sách tên cần gõ)."],
    fields: [
      { name: "Output variable name", description: "Tên của biến danh sách cần tạo.", details: [] },
      { name: "Item value type", description: "Kiểu dữ liệu của các phần tử trong danh sách.", details: [] },
      { name: "List items", description: "Các phần tử của danh sách, nhập mỗi giá trị một dòng.", details: [] }
    ],
    examples: ["Output name: country_list, Type: Text, Items: Vietnam\\nThailand\\nSingapore"],
    commonMistakes: ["Để trống danh sách phần tử, dẫn tới tạo ra danh sách rỗng."],
  },
  split_text_to_list: {
    title: "Trợ giúp Tách Văn bản thành Danh sách (Split Text to List)",
    summary: "Tách một chuỗi văn bản thành danh sách dựa trên ký tự phân tách.",
    useWhen: ["Dùng khi nhận được một chuỗi text cách nhau bằng dấu phẩy, khoảng trắng, gạch đứng và muốn phân chia thành mảng để duyệt loop."],
    fields: [
      { name: "Output variable name", description: "Tên của biến danh sách mới cần lưu.", details: [] },
      { name: "Source text to split", description: "Nội dung văn bản nguồn cần tách.", details: [] },
      { name: "Delimiter", description: "Ký tự phân tách (ví dụ: dấu phẩy ',', khoảng trắng ' ', hoặc dấu xuống dòng '\\n').", details: [] }
    ],
    examples: ["Output: categories, Source: 'Thể thao,Thời sự,Giải trí', Delimiter: ','"],
    commonMistakes: ["Sử dụng ký tự phân tách không khớp với ký tự thực tế trong chuỗi nguồn, làm danh sách chỉ chứa 1 phần tử."],
  },
  generate_number_range: {
    title: "Trợ giúp Tạo Dãy số (Generate Number Range)",
    summary: "Tạo danh sách các số tự động chạy trong khoảng từ Bắt đầu đến Kết thúc.",
    useWhen: ["Dùng để tạo chỉ mục trang cho các vòng lặp chuyển trang (phân trang)."],
    fields: [
      { name: "Output variable name", description: "Tên biến danh sách mới cần tạo.", details: [] },
      { name: "Start value", description: "Số bắt đầu.", details: [] },
      { name: "End value", description: "Số kết thúc (bao gồm cả số này).", details: [] },
      { name: "Step size", description: "Bước nhảy số (mặc định là 1).", details: [] }
    ],
    examples: ["Output: pages, Start: 1, End: 10, Step: 1 để sinh mảng từ 1 đến 10."],
    commonMistakes: ["Cấu hình bước nhảy là 0 hoặc sai hướng tăng/giảm so với biên, dẫn đến lỗi tạo dãy số."],
  },
  add_to_list: {
    title: "Trợ giúp Thêm vào Danh sách (Add to List)",
    summary: "Thêm phần tử vào vị trí đầu, cuối hoặc thêm duy nhất (chỉ thêm nếu chưa tồn tại) vào danh sách.",
    useWhen: ["Dùng để thu thập dữ liệu cào được trong vòng lặp vào một mảng kết quả chung."],
    fields: [
      { name: "Target list variable name", description: "Tên danh sách đích cần thêm phần tử.", details: [] },
      { name: "Add position", description: "Vị trí thêm phần tử (start - đầu mảng, end - cuối mảng, unique - chỉ thêm nếu chưa có trong mảng).", details: [] },
      { name: "Value type", description: "Kiểu dữ liệu của giá trị cần chèn.", details: [] },
      { name: "Value to add", description: "Giá trị phần tử cần chèn (hỗ trợ biến động).", details: [] }
    ],
    examples: ["Target: collected_titles, Position: end, Value type: Text, Value: {{extracted_title}}"],
    commonMistakes: ["Chỉ định tên danh sách đích trỏ vào một biến có kiểu dữ liệu là chuỗi hoặc số."],
  },
  remove_from_list_by_index: {
    title: "Trợ giúp Xóa khỏi Danh sách bằng Index (Remove by Index)",
    summary: "Xóa phần tử tại vị trí chỉ mục (index) xác định trong danh sách.",
    useWhen: ["Dùng khi muốn loại bỏ một phần tử ở vị trí biết trước (ví dụ: loại bỏ hàng đầu tiên)."],
    fields: [
      { name: "Target list variable name", description: "Tên danh sách cần sửa đổi.", details: [] },
      { name: "Index", description: "Vị trí phần tử cần xóa (chỉ mục bắt đầu từ 0).", details: [] }
    ],
    examples: ["Target: task_queue, Index: 0 để xóa phần tử đầu tiên."],
    commonMistakes: ["Cung cấp chỉ mục vượt quá phạm vi độ dài thực tế của danh sách (index out of bounds)."],
  },
  remove_from_list_by_value: {
    title: "Trợ giúp Xóa khỏi Danh sách bằng Giá trị (Remove by Value)",
    summary: "Xóa tất cả các phần tử trong danh sách khớp với một giá trị chỉ định.",
    useWhen: ["Dùng khi muốn loại bỏ các phần tử cụ thể (ví dụ: xóa các giá trị 'nháp' hoặc 'lỗi' khỏi mảng trạng thái)."],
    fields: [
      { name: "Target list variable name", description: "Tên danh sách cần sửa đổi.", details: [] },
      { name: "Value type", description: "Kiểu dữ liệu của giá trị cần xóa.", details: [] },
      { name: "Value to match for removal", description: "Giá trị cụ thể cần lọc bỏ.", details: [] }
    ],
    examples: ["Target: user_roles, Value type: Text, Value to match: 'guest'"],
    commonMistakes: ["Kiểu dữ liệu của giá trị so sánh để xóa không khớp với kiểu dữ liệu thực tế của các phần tử trong mảng."],
  },
  merge_lists: {
    title: "Trợ giúp Gộp Danh sách (Merge Lists)",
    summary: "Gộp một danh sách khác hoặc một mảng JSON vào danh sách đích.",
    useWhen: ["Dùng khi cần hợp nhất hai mảng dữ liệu thu thập được từ hai trang khác nhau."],
    fields: [
      { name: "Target list variable name", description: "Tên danh sách đích nhận dữ liệu gộp.", details: [] },
      { name: "List to merge", description: "Biến mảng nguồn hoặc chuỗi mảng JSON cần gộp vào.", details: [] },
      { name: "Merge unique items only", description: "Chỉ gộp các phần tử chưa có ở danh sách đích (tránh trùng lặp).", details: [] }
    ],
    examples: ["Target: all_products, List to merge: {{page_products}}, Unique: true"],
    commonMistakes: ["Gộp một biến nguồn không phải kiểu danh sách (ví dụ truyền chuỗi thô)."],
  },
  get_list_item: {
    title: "Trợ giúp Lấy Phần tử Danh sách (Get List Item)",
    summary: "Trích xuất một phần tử cụ thể khỏi danh sách theo chỉ mục hoặc vị trí đặc biệt (đầu, cuối, ngẫu nhiên).",
    useWhen: ["Dùng khi muốn lấy một tài khoản ngẫu nhiên từ danh sách để đăng nhập hoặc lấy phần tử đầu tiên để xử lý."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Position", description: "Vị trí cần lấy (first - đầu, last - cuối, random - ngẫu nhiên, specific_index - chỉ mục cụ thể).", details: [] },
      { name: "Index", description: "Chỉ số cụ thể bắt đầu từ 0 (chỉ dùng khi chọn vị trí specific_index).", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu phần tử lấy được.", details: [] }
    ],
    examples: ["Source: proxylist, Position: random, Result: current_proxy"],
    commonMistakes: ["Nhập chỉ mục vượt quá độ dài danh sách, khiến kết quả trả về là undefined."],
  },
  get_list_length: {
    title: "Trợ giúp Lấy Độ dài Danh sách (Get List Length)",
    summary: "Đo tổng số lượng phần tử có trong danh sách.",
    useWhen: ["Dùng để kiểm tra số lượng phần tử cào được hoặc dùng làm điều kiện dừng vòng lặp."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến đầu ra lưu độ dài.", details: [] }
    ],
    examples: ["Source: users_array, Result: users_count"],
    commonMistakes: ["Thực hiện đo độ dài trên biến không tồn tại hoặc không phải kiểu danh sách."],
  },
  slice_list: {
    title: "Trợ giúp Cắt Danh sách (Slice List)",
    summary: "Trích xuất một danh sách con (phân mảng) từ chỉ mục bắt đầu đến kết thúc.",
    useWhen: ["Dùng khi muốn chia nhỏ danh sách lớn thành các nhóm nhỏ (batch) để xử lý dần."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Start index", description: "Vị trí bắt đầu cắt (bao gồm cả vị trí này).", details: [] },
      { name: "End index", description: "Vị trí kết thúc cắt (tùy chọn, không bao gồm vị trí này).", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu danh sách con.", details: [] }
    ],
    examples: ["Source: all_records, Start: 0, End: 10, Result: first_batch để lấy 10 phần tử đầu tiên."],
    commonMistakes: ["Đặt vị trí bắt đầu lớn hơn vị trí kết thúc, tạo ra danh sách con rỗng."],
  },
  join_list: {
    title: "Trợ giúp Nối Danh sách thành Text (Join List)",
    summary: "Nối tất cả các phần tử trong danh sách thành một chuỗi văn bản duy nhất bằng ký tự phân tách.",
    useWhen: ["Dùng khi muốn chuyển mảng từ khóa thành một chuỗi văn bản để hiển thị hoặc ghi vào file."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Separator text", description: "Ký tự phân tách đặt giữa các phần tử (ví dụ: dấu phẩy, khoảng trắng, xuống dòng '\\n').", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu văn bản kết quả.", details: [] }
    ],
    examples: ["Source: keywords_list, Separator: '; ', Result: keywords_string"],
    commonMistakes: ["Nối danh sách chứa các đối tượng phức tạp (JSON Object) mà không chuyển đổi thuộc tính trước, tạo ra chuỗi chứa '[object Object]'."],
  },
  filter_list: {
    title: "Trợ giúp Lọc Danh sách (Filter List)",
    summary: "Lọc các phần tử của danh sách dựa trên các quy tắc điều kiện định nghĩa sẵn.",
    useWhen: ["Dùng khi muốn giữ lại hoặc loại bỏ các phần tử trong mảng thỏa mãn điều kiện (ví dụ: lọc danh sách sản phẩm có giá > 100)."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu danh sách đã lọc.", details: [] },
      { name: "Combine operator", description: "Toán tử kết hợp các quy tắc (AND - tất cả đều đúng, OR - chỉ cần một cái đúng).", details: [] },
      { name: "Filter rules", description: "Danh sách các quy tắc lọc.", details: [] }
    ],
    examples: ["Source: products, Result: cheap_products, Combine: AND, Rules: item.price < 50"],
    commonMistakes: ["Quên không tham chiếu bằng tiền tố 'item.' khi định nghĩa điều kiện lọc (ví dụ: ghi 'price < 50' thay vì 'item.price < 50')."],
  },
  map_list_property: {
    title: "Trợ giúp Ánh xạ thuộc tính (Map List Property)",
    summary: "Trích xuất một thuộc tính cụ thể từ danh sách các đối tượng để tạo thành mảng mới.",
    useWhen: ["Dùng khi bạn có danh sách đối tượng người dùng (chứa name, email, id) và chỉ muốn lấy danh sách email."],
    fields: [
      { name: "Source list", description: "Tên danh sách đối tượng nguồn.", details: [] },
      { name: "Property key to extract", description: "Khóa thuộc tính cần lấy ra (ví dụ: 'email').", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu mảng thuộc tính kết quả.", details: [] }
    ],
    examples: ["Source: users, Key: 'email', Result: email_list"],
    commonMistakes: ["Chạy ánh xạ trên một mảng chứa các giá trị nguyên thủy (chuỗi, số) thay vì mảng đối tượng."],
  },
  sort_reverse_list: {
    title: "Trợ giúp Sắp xếp / Đảo ngược Danh sách (Sort / Reverse List)",
    summary: "Sắp xếp lại thứ tự các phần tử trong danh sách hoặc đảo ngược danh sách.",
    useWhen: ["Dùng khi cần sắp xếp danh sách giá cả tăng dần hoặc đảo ngược danh sách lịch sử chạy."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Action", description: "Hành động (sort_asc - sắp xếp tăng dần, sort_desc - sắp xếp giảm dần, reverse - đảo ngược thứ tự).", details: [] },
      { name: "Sort key", description: "Khóa thuộc tính để sắp xếp (chỉ dùng khi danh sách chứa các đối tượng, ví dụ: 'price').", details: [] },
      { name: "Result output variable name", description: "Biến lưu danh sách kết quả.", details: [] }
    ],
    examples: ["Source: score_list, Action: sort_desc, Result: sorted_scores"],
    commonMistakes: ["Sắp xếp mảng hỗn hợp chứa cả chuỗi văn bản và số, dẫn tới kết quả sắp xếp không đúng mong muốn."],
  },
  create_empty_object: {
    title: "Trợ giúp Tạo Đối tượng Rỗng (Create Empty Object)",
    summary: "Khởi tạo một biến đối tượng JSON rỗng ({}).",
    useWhen: ["Dùng để tạo một đối tượng trống trước khi lần lượt gán các thuộc tính ở các bước tiếp theo."],
    fields: [
      { name: "Output variable name", description: "Tên biến đối tượng mới cần tạo.", details: [] }
    ],
    examples: ["Output variable name: user_profile"],
    commonMistakes: ["Để trống tên biến đầu ra, khiến hệ thống không thể lưu trữ đối tượng."],
  },
  create_object_manual: {
    title: "Trợ giúp Tạo Đối tượng Thủ công (Create Object Manual)",
    summary: "Tạo một đối tượng JSON bằng cách khai báo trực tiếp danh sách các cặp khóa-giá trị (key-value).",
    useWhen: ["Dùng khi cần tạo cấu trúc dữ liệu tĩnh để gửi API hoặc làm payload."],
    fields: [
      { name: "Output variable name", description: "Tên biến đối tượng cần tạo.", details: [] },
      { name: "Object fields list", description: "Danh sách các cặp khóa và giá trị tương ứng.", details: [] }
    ],
    examples: ["Output name: payload, Fields: name='Nguyen', age=30, active=true"],
    commonMistakes: ["Khai báo trùng lặp khóa thuộc tính (key) trong bảng danh sách trường."],
  },
  parse_json_to_object: {
    title: "Trợ giúp Phân tích JSON thành Đối tượng (Parse JSON to Object)",
    summary: "Phân tích một chuỗi văn bản định dạng JSON thành biến đối tượng JSON có cấu trúc.",
    useWhen: ["Dùng để giải mã phản hồi API thô (raw JSON string) hoặc dữ liệu đọc từ file thành đối tượng để truy xuất thuộc tính."],
    fields: [
      { name: "JSON source text", description: "Chuỗi JSON thô cần phân tích.", details: [] },
      { name: "Output variable name", description: "Tên biến lưu đối tượng sau khi phân tích.", details: [] }
    ],
    examples: ["Source text: '{\"status\": 200, \"data\": []}', Output name: api_response"],
    commonMistakes: ["Cung cấp chuỗi JSON sai định dạng (ví dụ dùng dấu nháy đơn ' thay vì nháy kép \" cho các key), gây lỗi parse runtime."],
  },
  set_object_property: {
    title: "Trợ giúp Đặt Thuộc tính Đối tượng (Set Object Property)",
    summary: "Thêm hoặc cập nhật giá trị thuộc tính tại một đường dẫn (hỗ trợ dot-path) trong đối tượng.",
    useWhen: ["Dùng khi muốn cập nhật thông tin chi tiết của đối tượng (ví dụ: cập nhật token đăng nhập vào user.auth.token)."],
    fields: [
      { name: "Variable name", description: "Tên biến đối tượng cần cập nhật.", details: [] },
      { name: "Property path", description: "Khóa hoặc đường dẫn dot-path (ví dụ: 'profile.email').", details: [] },
      { name: "Value type", description: "Kiểu dữ liệu của giá trị cần gán.", details: [] },
      { name: "Value", description: "Giá trị cần gán.", details: [] }
    ],
    examples: ["Variable: user, Property path: 'contact.phone', Value type: Text, Value: '0901234567'"],
    commonMistakes: ["Trỏ đường dẫn thuộc tính vào một biến đích không phải kiểu đối tượng JSON."],
  },
  remove_object_property: {
    title: "Trợ giúp Xóa Thuộc tính Đối tượng (Remove Object Property)",
    summary: "Xóa một thuộc tính khỏi đối tượng tại đường dẫn chỉ định (hỗ trợ dot-path).",
    useWhen: ["Dùng khi cần xóa bỏ các dữ liệu rác hoặc khóa nhạy cảm (như mật khẩu) trước khi gửi API."],
    fields: [
      { name: "Variable name", description: "Tên biến đối tượng cần sửa đổi.", details: [] },
      { name: "Property path", description: "Đường dẫn dot-path của khóa cần xóa.", details: [] }
    ],
    examples: ["Variable: credentials, Property path: 'password'"],
    commonMistakes: ["Cố gắng xóa đường dẫn thuộc tính không tồn tại trong đối tượng (thao tác này no-op nhưng có thể làm rối luồng log)."],
  },
  merge_objects: {
    title: "Trợ giúp Gộp Đối tượng (Merge Objects)",
    summary: "Gộp các thuộc tính từ đối tượng nguồn hoặc chuỗi JSON nguồn vào đối tượng đích.",
    useWhen: ["Dùng khi cần kết hợp dữ liệu từ cấu hình chung và cấu hình riêng."],
    fields: [
      { name: "Variable name", description: "Tên biến đối tượng đích nhận dữ liệu gộp.", details: [] },
      { name: "Value to merge", description: "Tên biến đối tượng nguồn hoặc chuỗi JSON nguồn cần gộp vào.", details: [] },
      { name: "Deep merge", description: "Bật để gộp đệ quy các đối tượng con bên trong; tắt để ghi đè các đối tượng cấp cao nhất.", details: [] }
    ],
    examples: ["Variable: base_settings, Value to merge: {{user_settings}}, Deep merge: true"],
    commonMistakes: ["Gộp chuỗi JSON không hợp lệ vào đối tượng đích."],
  },
  rename_object_property: {
    title: "Trợ giúp Đổi tên Thuộc tính Đối tượng (Rename Object Property)",
    summary: "Đổi tên khóa thuộc tính của đối tượng trong khi vẫn giữ nguyên giá trị của nó.",
    useWhen: ["Dùng để chuẩn hóa lại tên trường dữ liệu cho khớp với yêu cầu hệ thống khác."],
    fields: [
      { name: "Variable name", description: "Tên biến đối tượng cần sửa đổi.", details: [] },
      { name: "Old key path", description: "Tên khóa hoặc đường dẫn cũ cần đổi.", details: [] },
      { name: "New key path", description: "Tên khóa hoặc đường dẫn mới.", details: [] }
    ],
    examples: ["Variable: employee, Old key path: 'job', New key path: 'role'"],
    commonMistakes: ["Đổi tên khóa không tồn tại trong đối tượng, khiến đối tượng không thay đổi."],
  },
  get_object_property: {
    title: "Trợ giúp Lấy Thuộc tính Đối tượng (Get Object Property)",
    summary: "Lấy giá trị của một thuộc tính từ đối tượng tại đường dẫn chỉ định (hỗ trợ dot-path).",
    useWhen: ["Dùng khi có một đối tượng phức tạp và cần trích xuất giá trị sâu bên trong (ví dụ: lấy user.address.city)."],
    fields: [
      { name: "Source object variable name", description: "Tên biến đối tượng nguồn.", details: [] },
      { name: "Property path", description: "Đường dẫn dot-path dẫn tới thuộc tính cần lấy.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu giá trị lấy được.", details: [] }
    ],
    examples: ["Source: profile, Property path: 'preferences.theme', Result: user_theme"],
    commonMistakes: ["Lấy giá trị từ một đường dẫn không tồn tại, khiến kết quả nhận được là undefined."],
  },
  get_object_keys: {
    title: "Trợ giúp Lấy Danh sách Khóa Đối tượng (Get Object Keys)",
    summary: "Trích xuất danh sách tất cả các khóa (keys) cấp cao nhất của đối tượng thành một mảng chuỗi.",
    useWhen: ["Dùng khi cần duyệt qua tất cả các thuộc tính của đối tượng trong vòng lặp."],
    fields: [
      { name: "Source object variable name", description: "Tên biến đối tượng nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu danh sách các khóa.", details: [] }
    ],
    examples: ["Source: student_record, Result: fields_array để lấy các trường thông tin."],
    commonMistakes: ["Chạy lấy khóa trên một biến có kiểu dữ liệu nguyên thủy hoặc mảng."],
  },
  get_object_values: {
    title: "Trợ giúp Lấy Danh sách Giá trị Đối tượng (Get Object Values)",
    summary: "Trích xuất tất cả các giá trị (values) ở cấp cao nhất của đối tượng thành một mảng.",
    useWhen: ["Dùng khi bạn chỉ cần thu thập dữ liệu nội dung mà không quan tâm đến tên khóa."],
    fields: [
      { name: "Source object variable name", description: "Tên biến đối tượng nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu danh sách các giá trị.", details: [] }
    ],
    examples: ["Source: settings_obj, Result: config_values"],
    commonMistakes: ["Chạy lấy giá trị trên một biến không phải kiểu đối tượng JSON."],
  },
  stringify_object: {
    title: "Trợ giúp Chuyển Đối tượng thành Chuỗi (Stringify Object)",
    summary: "Chuyển đổi một đối tượng JSON thành chuỗi văn bản dạng JSON thô (JSON String).",
    useWhen: ["Dùng khi cần ghi đối tượng ra file văn bản hoặc gửi qua HTTP POST body."],
    fields: [
      { name: "Source object variable name", description: "Tên biến đối tượng nguồn.", details: [] },
      { name: "Result output variable name", description: "Biến lưu chuỗi JSON văn bản kết quả.", details: [] }
    ],
    examples: ["Source: request_data, Result: raw_payload_string"],
    commonMistakes: ["Đối tượng chứa tham chiếu vòng tròn (circular references) khiến việc chuyển chuỗi bị lỗi."],
  },
  execute_object_script: {
    title: "Trợ giúp Chạy Script trên Đối tượng (Execute Object Script)",
    summary: "Chạy mã JavaScript tùy chỉnh để biến đổi hoặc xử lý đối tượng.",
    useWhen: ["Dùng cho các phép biến đổi phức tạp trên đối tượng mà các node trực quan không hỗ trợ thuận tiện."],
    fields: [
      { name: "Source object variable name", description: "Tên biến đối tượng nguồn.", details: [] },
      { name: "JavaScript Script", description: "Mã Script JavaScript. Đối tượng nguồn được truyền vào qua biến cục bộ 'obj'.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu kết quả trả về từ Script.", details: [] }
    ],
    examples: ["Source: raw_user, Script: 'obj.fullname = obj.fname + \" \" + obj.lname; return obj;', Result: formatted_user"],
    commonMistakes: ["Quên không viết câu lệnh return trong đoạn script để trả về đối tượng kết quả."],
  },
  check_object_key_exists: {
    title: "Trợ giúp Kiểm tra Khóa Tồn tại (Check Object Key Exists)",
    summary: "Kiểm tra xem một khóa hoặc đường dẫn dot-path có tồn tại trong đối tượng hay không.",
    useWhen: ["Dùng để kiểm tra sự tồn tại của trường dữ liệu trước khi xử lý (ví dụ: nếu có trường 'error' thì báo lỗi)."],
    fields: [
      { name: "Source object variable name", description: "Tên biến đối tượng nguồn.", details: [] },
      { name: "Property path", description: "Khóa hoặc đường dẫn dot-path cần kiểm tra.", details: [] },
      { name: "Result output variable name", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Source: api_response, Property path: 'errors.message', Result: has_error"],
    commonMistakes: ["Kiểm tra sự tồn tại của khóa trên một biến không phải kiểu đối tượng."],
  },
  check_object_empty: {
    title: "Trợ giúp Kiểm tra Đối tượng Rỗng (Check Object Empty)",
    summary: "Kiểm tra xem đối tượng JSON có rỗng hay không (không chứa bất kỳ thuộc tính nào).",
    useWhen: ["Dùng để phân nhánh logic khi nhận về phản hồi rỗng từ API."],
    fields: [
      { name: "Source object variable name", description: "Tên biến đối tượng nguồn.", details: [] },
      { name: "Result output variable name", description: "Biến lưu kết quả boolean (true nếu rỗng).", details: [] }
    ],
    examples: ["Source: data_response, Result: is_data_empty"],
    commonMistakes: ["Chạy kiểm tra trên biến rỗng (null/undefined) mà không phải là một đối tượng trống ({})."],
  },
  execute_list_script: {
    title: "Trợ giúp Chạy Script trên Danh sách (Execute List Script)",
    summary: "Chạy mã JavaScript tùy chỉnh để biến đổi hoặc lọc danh sách.",
    useWhen: ["Dùng cho các phép lọc nâng cao hoặc biến đổi mảng phức tạp bằng mã lập trình."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "JavaScript Script", description: "Mã Script JavaScript. Mảng nguồn được truyền vào qua biến cục bộ 'list'.", details: [] },
      { name: "Result output variable name", description: "Biến lưu kết quả trả về từ Script.", details: [] }
    ],
    examples: ["Source: emails, Script: 'return list.filter(e => e.endsWith(\"@gmail.com\"));', Result: gmail_list"],
    commonMistakes: ["Quên viết câu lệnh return trả về mảng kết quả từ đoạn script."],
  },
  check_list_empty: {
    title: "Trợ giúp Kiểm tra Danh sách Rỗng (Check List Empty)",
    summary: "Kiểm tra xem mảng danh sách có rỗng (không chứa phần tử nào) hay không.",
    useWhen: ["Dùng để dừng hoặc rẽ hướng luồng khi danh sách hàng đợi rỗng."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Source: pending_tasks, Result: is_queue_empty"],
    commonMistakes: ["Kiểm tra độ rỗng trên một biến chưa được khởi tạo, gây lỗi chương trình."],
  },
  check_list_contains: {
    title: "Trợ giúp Kiểm tra Danh sách Chứa (Check List Contains)",
    summary: "Kiểm tra xem danh sách có chứa một giá trị cụ thể nào đó hay không.",
    useWhen: ["Dùng để xác thực sự hiện diện của một phần tử trong danh sách."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Value type to check", description: "Kiểu dữ liệu của giá trị cần kiểm tra.", details: [] },
      { name: "Value to search for", description: "Giá trị cụ thể cần tìm kiếm.", details: [] },
      { name: "Result output variable name", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Source: group_members, Value type: Text, Value to search: 'admin', Result: is_admin_present"],
    commonMistakes: ["Kiểu dữ liệu cấu hình để so khớp không trùng với kiểu dữ liệu của các phần tử trong mảng."],
  },
  check_list_any_match: {
    title: "Trợ giúp Khớp Bất kỳ trong Danh sách (Check List Any Match)",
    summary: "Kiểm tra xem có ít nhất một phần tử trong danh sách thỏa mãn các quy tắc lọc.",
    useWhen: ["Dùng khi muốn xác minh xem trong mảng sản phẩm có cái nào giá rẻ hơn ngưỡng hay không."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Biến lưu kết quả boolean.", details: [] },
      { name: "Combine operator", description: "Toán tử kết hợp (AND/OR).", details: [] },
      { name: "Filter rules", description: "Danh sách quy tắc kiểm tra.", details: [] }
    ],
    examples: ["Source: prices_list, Result: has_discounted, Combine: OR, Rules: item.price < 10000"],
    commonMistakes: ["Quên không tham chiếu bằng tiền tố 'item.' trong quy tắc so sánh."],
  },
  check_list_all_match: {
    title: "Trợ giúp Khớp Tất cả trong Danh sách (Check List All Match)",
    summary: "Kiểm tra xem tất cả các phần tử trong danh sách có đồng thời thỏa mãn các quy tắc hay không.",
    useWhen: ["Dùng để xác thực chất lượng dữ liệu (ví dụ: xác minh tất cả sản phẩm đều đã được duyệt)."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Biến lưu kết quả boolean.", details: [] },
      { name: "Combine operator", description: "Toán tử kết hợp (AND/OR).", details: [] },
      { name: "Filter rules", description: "Danh sách quy tắc kiểm tra.", details: [] }
    ],
    examples: ["Source: accounts, Result: all_verified, Combine: AND, Rules: item.status === 'verified'"],
    commonMistakes: ["Quên không tham chiếu bằng tiền tố 'item.' trong quy tắc so sánh."],
  },
};
