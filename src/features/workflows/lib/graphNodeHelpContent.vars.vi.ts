import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const varsNodesVi: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  set_variable: {
    title: "Trợ giúp Lưu Biến (Set Variables)",
    summary: "Lưu trữ một hoặc nhiều biến với các kiểu dữ liệu khác nhau để các node sau sử dụng.",
    useWhen: ["Dùng để khởi tạo cấu hình, lưu trữ trạng thái chạy hoặc lưu trữ dữ liệu tĩnh ban đầu."],
    fields: [
      {
        name: "Rows",
        description: "Danh sách các biến cần lưu.",
        details: [
          "Mỗi dòng cấu hình gồm Tên biến (Name), Kiểu dữ liệu (Type: text, number, boolean, JSON) và Giá trị (Value).",
          "Hỗ trợ truy xuất động qua dot-notation, ví dụ: user.name."
        ],
      },
    ],
    examples: ["Name: user.name, Type: Text, Value: 'Nguyen Van A'\\nName: app_version, Type: Number, Value: 2.1"],
    commonMistakes: ["Đặt tên biến có chứa khoảng trắng hoặc kí tự đặc biệt, khiến việc gọi biến ở các bước sau bị lỗi."],
  },
  set_json_variables: {
    title: "Trợ giúp Lưu Biến từ JSON (Set JSON Variables)",
    summary: "Khởi tạo nhiều biến cùng lúc bằng cách phân tích một đối tượng JSON Object.",
    useWhen: ["Dùng khi cần lưu cấu hình phức tạp hoặc nạp nhanh một loạt dữ liệu từ file/API dưới dạng JSON."],
    fields: [
      {
        name: "JSON variables",
        description: "Chuỗi JSON biểu diễn đối tượng chứa các biến.",
        details: [
          "Các trường trong đối tượng JSON sẽ tự động được chuyển thành biến độc lập.",
          "Cấu trúc đối tượng lồng nhau sẽ được flatten thành dạng dot-path (ví dụ: { 'a': { 'b': 1 } } thành a.b = 1)."
        ],
      },
    ],
    examples: ["JSON variables: { \"session\": { \"id\": 1001, \"active\": true } } để tạo session.id và session.active."],
    commonMistakes: ["Nhập chuỗi JSON không đúng định dạng chuẩn (ví dụ: thiếu dấu ngoặc kép đôi cho các key)."],
  },
  check_conditions: {
    title: "Trợ giúp Kiểm tra Điều kiện (Check Conditions)",
    summary: "Đánh giá các điều kiện logic hoặc chạy mã Javascript để trả về kết quả True hoặc False.",
    useWhen: ["Dùng trước khi rẽ nhánh If/While để tính toán điều kiện logic phức tạp từ nhiều biến."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "Tên biến đầu ra để lưu kết quả kiểm tra (nhận giá trị true hoặc false).",
        details: []
      },
      {
        name: "Evaluation Mode",
        description: "Chế độ đánh giá (Visual Rules - luật trực quan hoặc JavaScript Code).",
        details: [
          "Ở chế độ JavaScript, bạn có thể truy cập các biến đầu ra qua đối tượng 'outputs' (ví dụ: outputs.count > 10).",
          "Hỗ trợ chèn biến trực tiếp bằng cú pháp double curly braces, ví dụ: {{count}} > 10."
        ]
      }
    ],
    examples: ["Result: is_valid, Mode: JavaScript, Expression: outputs.score >= 50 && outputs.verified === true"],
    commonMistakes: ["Viết sai cú pháp biểu thức JavaScript hoặc tham chiếu đến biến chưa được khởi tạo."],
  },
  calculate_value: {
    title: "Trợ giúp Tính toán Giá trị (Calculate Value)",
    summary: "Thực hiện tính toán biểu thức JavaScript/Toán học và lưu lại kết quả thô.",
    useWhen: ["Dùng khi cần tính toán số học hoặc xử lý logic nâng cao và lưu kết quả (ví dụ: cộng chuỗi, tính toán thuế)."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "Tên biến lưu kết quả sau khi tính toán.",
        details: []
      },
      {
        name: "JavaScript / Math Expression",
        description: "Biểu thức toán học hoặc đoạn mã Javascript cần tính toán.",
        details: [
          "Đoạn mã phải trả về giá trị.",
          "Có thể sử dụng outputs.name để đọc các biến trước đó."
        ]
      }
    ],
    examples: ["Result: total_with_tax, Expression: outputs.subtotal * 1.1"],
    commonMistakes: ["Thực hiện phép tính trên biến kiểu chữ (string) mà quên parse sang kiểu số trước đó."],
  },
  update_number_variable: {
    title: "Trợ giúp Cập nhật Biến Số (Update Number Variable)",
    summary: "Thực hiện các phép toán cơ bản trực tiếp trên một biến số hiện có.",
    useWhen: ["Dùng khi muốn tăng/giảm biến đếm hoặc thực hiện cộng dồn giá trị."],
    fields: [
      { name: "Variable name", description: "Tên biến số cần cập nhật.", details: [] },
      { name: "Operation", description: "Phép toán (cộng, trừ, nhân, chia, tăng, giảm).", details: [] },
      { name: "Value", description: "Giá trị toán hạng dùng cho phép toán.", details: [] }
    ],
    examples: ["Variable name: attempt_count, Operation: Increment (Tăng 1)"],
    commonMistakes: ["Thực hiện cập nhật trên biến chưa được khởi tạo, khiến biến nhận giá trị NaN."],
  },
  set_number_variable: {
    title: "Trợ giúp Đặt Biến Số (Set Number Variable)",
    summary: "Khởi tạo hoặc đặt giá trị số cho một biến đầu ra.",
    useWhen: ["Dùng để khởi tạo biến đếm trước vòng lặp hoặc đặt giá trị số tĩnh."],
    fields: [
      { name: "Result variable", description: "Tên biến số đầu ra cần lưu.", details: [] },
      { name: "Value", description: "Giá trị số cần đặt (hỗ trợ mẫu template dạng {{biến}}).", details: [] }
    ],
    examples: ["Result variable: page_limit, Value: 10"],
    commonMistakes: ["Nhập chuỗi văn bản chữ không thể chuyển đổi thành số làm giá trị biến đầu ra."],
  },
  generate_random_number: {
    title: "Trợ giúp Tạo Số Ngẫu Nhiên (Generate Random Number)",
    summary: "Tạo một số ngẫu nhiên trong khoảng min/max chỉ định.",
    useWhen: ["Dùng để tạo độ trễ ngẫu nhiên mô phỏng người dùng hoặc tạo dữ liệu giả lập."],
    fields: [
      { name: "Result variable", description: "Tên biến đầu ra lưu số ngẫu nhiên.", details: [] },
      { name: "Minimum value", description: "Giá trị nhỏ nhất.", details: [] },
      { name: "Maximum value", description: "Giá trị lớn nhất.", details: [] },
      { name: "Generate integer only", description: "Chỉ tạo số nguyên (True) hoặc số thập phân (False).", details: [] }
    ],
    examples: ["Result variable: delay_time, Min: 1000, Max: 5000, Integer: true để tạo độ trễ từ 1-5 giây."],
    commonMistakes: ["Cấu hình giá trị Minimum lớn hơn Maximum."],
  },
  parse_text_to_number: {
    title: "Trợ giúp Phân tích Chuỗi thành Số (Parse Text to Number)",
    summary: "Chuyển đổi một chuỗi văn bản chứa số thành một giá trị số thực sự.",
    useWhen: ["Dùng sau khi trích xuất giá tiền hoặc số lượng từ trang web dưới dạng text và cần chuyển thành số để tính toán."],
    fields: [
      { name: "Source text", description: "Văn bản nguồn cần chuyển đổi.", details: [] },
      { name: "Fallback value", description: "Giá trị mặc định trả về nếu chuyển đổi thất bại (ví dụ: 0).", details: [] },
      { name: "Result variable", description: "Tên biến đầu ra để lưu số.", details: [] }
    ],
    examples: ["Source text: {{raw_price}}, Fallback: 0, Result: price_number"],
    commonMistakes: ["Quên không loại bỏ các ký tự không phải số (như $, đ, dấu phẩy phân tách nghìn) trước khi parse."],
  },
  math_operation: {
    title: "Trợ giúp Phép toán Số học (Math Operation)",
    summary: "Thực hiện phép tính toán học (cộng, trừ, nhân, chia, v.v.) giữa hai số.",
    useWhen: ["Dùng khi cần thực hiện các phép toán cơ bản hoặc nâng cao (abs, sqrt, min, max) trên hai biến số."],
    fields: [
      { name: "Operand 1", description: "Toán hạng thứ nhất.", details: [] },
      { name: "Operation", description: "Phép tính thực hiện (add, subtract, multiply, divide, abs, sqrt, min, max).", details: [] },
      { name: "Operand 2", description: "Toán hạng thứ hai (bỏ qua với abs/sqrt).", details: [] },
      { name: "Result variable", description: "Tên biến lưu kết quả.", details: [] }
    ],
    examples: ["Operand 1: {{quantity}}, Operation: multiply, Operand 2: {{price}}, Result: subtotal"],
    commonMistakes: ["Thực hiện phép chia với Operand 2 có giá trị bằng 0."],
  },
  round_number: {
    title: "Trợ giúp Làm tròn Số (Round Number)",
    summary: "Làm tròn một số theo chế độ xác định (round, floor, ceil).",
    useWhen: ["Dùng để làm tròn phần thập phân sau khi thực hiện phép chia hoặc tính toán tỉ lệ."],
    fields: [
      { name: "Source number", description: "Số nguồn cần làm tròn.", details: [] },
      { name: "Rounding mode", description: "Chế độ làm tròn (round: gần nhất, floor: làm tròn xuống, ceil: làm tròn lên).", details: [] },
      { name: "Decimal places", description: "Số chữ số sau dấu phẩy muốn giữ lại (ví dụ: 2).", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả.", details: [] }
    ],
    examples: ["Source: 3.14159, Mode: round, Decimals: 2, Result: rounded_pi (kết quả: 3.14)"],
    commonMistakes: ["Đặt số lượng chữ số thập phân là số âm."],
  },
  format_number: {
    title: "Trợ giúp Định dạng Số (Format Number)",
    summary: "Chuyển đổi số thành chuỗi văn bản theo định dạng địa phương (tiền tệ, phần trăm, dấu phân cách).",
    useWhen: ["Dùng để xuất dữ liệu đẹp ra file báo cáo CSV hoặc hiển thị lên màn hình."],
    fields: [
      { name: "Source number", description: "Số cần định dạng.", details: [] },
      { name: "Format style", description: "Kiểu định dạng (decimal: số thường, percent: phần trăm, currency: tiền tệ).", details: [] },
      { name: "Decimal places", description: "Số chữ số thập phân.", details: [] },
      { name: "Currency code", description: "Mã tiền tệ (ví dụ: VND, USD) khi chọn kiểu currency.", details: [] },
      { name: "Locale", description: "Mã địa phương (ví dụ: vi-VN, en-US) để quyết định dấu chấm/phẩy phân cách.", details: [] },
      { name: "Result variable", description: "Tên biến lưu chuỗi kết quả.", details: [] }
    ],
    examples: ["Source: 1000000, Style: currency, Currency: VND, Locale: vi-VN -> '1.000.000 ₫'"],
    commonMistakes: ["Nhập sai định dạng mã Locale hoặc mã tiền tệ (Currency code) khiến hệ thống báo lỗi."],
  },
  compare_numbers: {
    title: "Trợ giúp So sánh Số (Compare Numbers)",
    summary: "So sánh hai giá trị số và trả về kết quả True/False.",
    useWhen: ["Dùng để kiểm tra điều kiện kích thước số (ví dụ: kiểm tra xem số lượng sản phẩm cào được đã đạt giới hạn chưa)."],
    fields: [
      { name: "Operand 1", description: "Toán hạng thứ nhất.", details: [] },
      { name: "Comparison operator", description: "Toán tử so sánh (lớn hơn, nhỏ hơn, bằng, khác, v.v.).", details: [] },
      { name: "Operand 2", description: "Toán hạng thứ hai.", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Operand 1: {{current_count}}, Operator: gte, Operand 2: {{max_count}}, Result: is_finished"],
    commonMistakes: ["So sánh một biến chưa được parse thành số với một số tĩnh, dẫn đến kết quả so sánh sai."],
  },
  check_number_range: {
    title: "Trợ giúp Kiểm tra Khoảng Số (Check Number Range)",
    summary: "Kiểm tra xem một số có nằm trong khoảng giá trị Min và Max chỉ định hay không.",
    useWhen: ["Dùng để xác thực dữ liệu số nằm trong biên cho phép."],
    fields: [
      { name: "Number value", description: "Số cần kiểm tra.", details: [] },
      { name: "Minimum bound", description: "Giới hạn dưới.", details: [] },
      { name: "Maximum bound", description: "Giới hạn trên.", details: [] },
      { name: "Inclusive bounds", description: "Có tính cả giá trị biên hay không.", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Number: {{age}}, Min: 18, Max: 60, Inclusive: true, Result: is_working_age"],
    commonMistakes: ["Cấu hình biên dưới (Minimum) lớn hơn biên trên (Maximum)."],
  },
  check_number_property: {
    title: "Trợ giúp Kiểm tra Tính chất Số (Check Number Property)",
    summary: "Kiểm tra xem một số là chẵn, lẻ, nguyên, dương hay âm.",
    useWhen: ["Dùng để phân chia logic chạy xen kẽ (ví dụ: chỉ click dòng chẵn)."],
    fields: [
      { name: "Number value", description: "Số cần kiểm tra.", details: [] },
      { name: "Property to check", description: "Tính chất cần kiểm tra (even, odd, positive, negative, integer).", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Number: {{row_index}}, Property: even, Result: is_even"],
    commonMistakes: ["Kiểm tra tính chẵn lẻ trên một số thập phân (float), gây ra kết quả không chính xác."],
  },
  update_text_variable: {
    title: "Trợ giúp Cập nhật Biến Chữ (Update Text Variable)",
    summary: "Thực hiện các thao tác xử lý chuỗi trực tiếp trên một biến chữ.",
    useWhen: ["Dùng khi cần cắt tỉa khoảng trắng, viết hoa/viết thường, hoặc thay thế text trong biến chữ hiện có."],
    fields: [
      { name: "Variable name", description: "Tên biến chữ cần cập nhật.", details: [] },
      { name: "Operation", description: "Thao tác chuỗi (append, prepend, replace, trim, uppercase, lowercase).", details: [] },
      { name: "Search pattern", description: "Mẫu tìm kiếm (chuỗi hoặc regex) dùng cho phép thay thế.", details: [] },
      { name: "Value", description: "Giá trị chèn thêm hoặc giá trị thay thế.", details: [] }
    ],
    examples: ["Variable: name, Operation: trim để dọn sạch khoảng trắng thừa."],
    commonMistakes: ["Sử dụng phép thay thế (replace) bằng Regex nhưng viết sai cú pháp biểu thức chính quy."],
  },
  set_text_variable: {
    title: "Trợ giúp Gán giá trị Text (Set Text Variable)",
    summary: "Gán giá trị văn bản cho một biến (hỗ trợ chèn các biến động bằng cú pháp double curly braces).",
    useWhen: ["Dùng để khởi tạo văn bản hoặc kết xuất chuỗi thông báo từ các biến sẵn có."],
    fields: [
      { name: "Output variable name", description: "Tên biến lưu kết quả.", details: [] },
      { name: "Text value", description: "Nội dung văn bản cần gán.", details: [] }
    ],
    examples: ["Output name: greeting, Value: 'Xin chào {{user.name}}, chúc một ngày tốt lành!'"],
    commonMistakes: ["Viết sai tên biến bên trong dấu ngoặc {{}}, dẫn tới kết quả văn bản bị rỗng hoặc lỗi."],
  },
  append_text: {
    title: "Trợ giúp Nối thêm Văn bản (Append Text)",
    summary: "Nối thêm một đoạn text vào cuối biến chữ hiện có.",
    useWhen: ["Dùng để ghi thêm thông tin vào chuỗi log hoặc cộng dồn kết quả."],
    fields: [
      { name: "Variable name", description: "Tên biến chữ cần cập nhật.", details: [] },
      { name: "Text to append", description: "Đoạn văn bản muốn nối thêm vào cuối.", details: [] }
    ],
    examples: ["Variable: log, Text to append: '\\n[SUCCESS] Completed step.'"],
    commonMistakes: ["Nối vào một biến chưa tồn tại hoặc có kiểu dữ liệu không phải là chữ."],
  },
  prepend_text: {
    title: "Trợ giúp Chèn thêm Văn bản (Prepend Text)",
    summary: "Chèn thêm một đoạn text vào đầu biến chữ hiện có.",
    useWhen: ["Dùng khi cần thêm tiền tố, tiêu đề hoặc ký hiệu vào đầu chuỗi."],
    fields: [
      { name: "Variable name", description: "Tên biến chữ cần cập nhật.", details: [] },
      { name: "Text to prepend", description: "Đoạn văn bản muốn chèn vào đầu.", details: [] }
    ],
    examples: ["Variable: filename, Text to prepend: 'backup_' để đổi 'report.pdf' thành 'backup_report.pdf'."],
    commonMistakes: ["Không khởi tạo biến trước khi chèn thêm tiền tố, dẫn đến biến có giá trị không mong muốn."],
  },
  replace_text: {
    title: "Trợ giúp Thay thế Văn bản (Replace Text)",
    summary: "Tìm và thay thế đoạn văn bản khớp mẫu thành văn bản mới.",
    useWhen: ["Dùng để loại bỏ các ký tự đặc biệt, định dạng lại chuỗi hoặc ẩn thông tin nhạy cảm."],
    fields: [
      { name: "Variable name", description: "Tên biến chữ cần sửa đổi.", details: [] },
      { name: "Search pattern", description: "Chuỗi hoặc mẫu Regex cần tìm.", details: [] },
      { name: "Replacement text", description: "Văn bản thay thế.", details: [] }
    ],
    examples: ["Variable: phone, Search: '\\s+', Replacement: '' để xóa mọi khoảng trắng."],
    commonMistakes: ["Nhầm lẫn giữa chuỗi tìm kiếm thường và Regex, ví dụ: tìm kiếm dấu chấm '.' bằng Regex mà quên không thoát thành '\\.'."],
  },
  trim_text: {
    title: "Trợ giúp Cắt Khoảng trắng (Trim Text)",
    summary: "Loại bỏ tất cả khoảng trắng dư thừa ở đầu và cuối chuỗi.",
    useWhen: ["Dùng để làm sạch dữ liệu nhập từ form hoặc dữ liệu lấy từ web trước khi lưu trữ/so sánh."],
    fields: [
      { name: "Variable name", description: "Tên biến chữ cần cắt khoảng trắng.", details: [] }
    ],
    examples: ["Variable: email_input để dọn sạch khoảng trắng do người dùng vô tình gõ dư."],
    commonMistakes: ["Không trim dữ liệu cào từ web trước khi thực hiện so sánh chính xác (equals), dẫn đến so sánh thất bại do có dấu cách ẩn."],
  },
  change_text_case: {
    title: "Trợ giúp Chuyển đổi Kiểu chữ (Change Text Case)",
    summary: "Chuyển chuỗi thành chữ in hoa toàn bộ hoặc chữ thường toàn bộ.",
    useWhen: ["Dùng để chuẩn hóa dữ liệu đầu vào (ví dụ: đưa email về dạng chữ thường trước khi đối chiếu)."],
    fields: [
      { name: "Variable name", description: "Tên biến chữ cần cập nhật.", details: [] },
      { name: "Case mode", description: "Kiểu viết (upper - viết hoa, lower - viết thường).", details: [] }
    ],
    examples: ["Variable: promo_code, Case mode: upper để đổi 'giamgia10' thành 'GIAMGIA10'."],
    commonMistakes: ["Chuyển đổi kiểu chữ trên biến rỗng hoặc có kiểu số."],
  },
  slice_text: {
    title: "Trợ giúp Cắt Chuỗi con (Slice Text)",
    summary: "Trích xuất một phần chuỗi dựa trên vị trí chỉ mục (index) bắt đầu và kết thúc.",
    useWhen: ["Dùng khi cần lấy một đoạn thông tin cố định trong chuỗi dài (ví dụ: lấy 4 số cuối của số thẻ)."],
    fields: [
      { name: "Source variable", description: "Biến chuỗi nguồn.", details: [] },
      { name: "Start index", description: "Vị trí bắt đầu cắt (tính từ 0, bao gồm cả vị trí này).", details: [] },
      { name: "End index", description: "Vị trí kết thúc cắt (tùy chọn, không bao gồm vị trí này).", details: [] },
      { name: "Result variable", description: "Biến lưu chuỗi con cắt được.", details: [] }
    ],
    examples: ["Source: full_card, Start: 12, End: 16, Result: last_four để cắt lấy 4 ký tự từ vị trí 12 đến 15."],
    commonMistakes: ["Đặt chỉ mục kết thúc nhỏ hơn hoặc bằng chỉ mục bắt đầu, dẫn đến kết quả chuỗi rỗng."],
  },
  regex_extract: {
    title: "Trợ giúp Trích xuất bằng Regex (Regex Extract)",
    summary: "Trích xuất chuỗi con phù hợp bằng biểu thức chính quy (Regular Expression).",
    useWhen: ["Dùng khi cần lọc thông tin có cấu trúc phức tạp từ văn bản thô (ví dụ: trích xuất mã OTP, số điện thoại, địa chỉ email, mã đơn hàng từ tin nhắn)."],
    fields: [
      { name: "Source variable", description: "Tên biến chuỗi nguồn chứa văn bản.", details: [] },
      { name: "Regex pattern", description: "Mẫu biểu thức chính quy dùng để khớp.", details: [] },
      { name: "Capture group index", description: "Thứ tự capture group cần lấy (nhóm được bọc trong dấu ngoặc đơn, mặc định là 1).", details: [] },
      { name: "Result variable", description: "Biến lưu chuỗi trích xuất được.", details: [] }
    ],
    examples: ["Source: sms_content, Regex: 'OTP: (\\d{6})', Group: 1, Result: otp_code"],
    commonMistakes: ["Quên không bọc dấu ngoặc đơn () trong Regex pattern để tạo Capture group, dẫn đến không trích xuất được đúng dữ liệu."],
  },
  get_text_length: {
    title: "Trợ giúp Lấy Độ dài Chuỗi (Get Text Length)",
    summary: "Đo số lượng ký tự trong một biến chuỗi.",
    useWhen: ["Dùng để kiểm tra độ dài đầu vào trước khi gửi form (ví dụ: kiểm tra độ dài mật khẩu hoặc số điện thoại có hợp lệ không)."],
    fields: [
      { name: "Source variable", description: "Biến chuỗi cần đo.", details: [] },
      { name: "Result variable", description: "Biến lưu độ dài (nhận kết quả dạng số).", details: [] }
    ],
    examples: ["Source: phone_number, Result: phone_length để kiểm tra xem có đủ 10 số hay không."],
    commonMistakes: ["Đo độ dài trên một biến chưa được định nghĩa hoặc có giá trị null, gây lỗi runtime."],
  },
  check_text_empty: {
    title: "Trợ giúp Kiểm tra Chuỗi Rỗng (Check Text Empty)",
    summary: "Kiểm tra xem chuỗi có bị rỗng, null hoặc chưa định nghĩa hay không.",
    useWhen: ["Dùng để phân nhánh rẽ hướng nếu dữ liệu lấy về bị thiếu hoặc trống."],
    fields: [
      { name: "Source variable", description: "Biến chuỗi cần kiểm tra.", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean (true nếu rỗng).", details: [] }
    ],
    examples: ["Source: error_message, Result: is_no_error để đi tiếp nếu không có thông báo lỗi."],
    commonMistakes: ["Chuỗi chứa các khoảng trắng (ví dụ '   ') sẽ không được coi là rỗng. Hãy dùng trim_text trước khi kiểm tra."],
  },
  check_text_contains: {
    title: "Trợ giúp Kiểm tra Chuỗi Chứa (Check Text Contains)",
    summary: "Kiểm tra xem chuỗi nguồn có chứa chuỗi con chỉ định hay không.",
    useWhen: ["Dùng để lọc từ khóa hoặc xác minh nội dung văn bản (ví dụ: kiểm tra xem tiêu đề trang có chứa chữ 'Thành công' không)."],
    fields: [
      { name: "Source variable", description: "Biến chuỗi nguồn.", details: [] },
      { name: "Substring to search", description: "Chuỗi con cần tìm kiếm.", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Source: page_content, Substring: 'Thanh toan thanh cong', Result: is_success"],
    commonMistakes: ["Phép tìm kiếm phân biệt chữ hoa/chữ thường (ví dụ: 'thành công' không khớp với 'Thành công')."],
  },
  check_text_regex_matches: {
    title: "Trợ giúp Kiểm tra Khớp Regex (Check Text Regex Matches)",
    summary: "Kiểm tra chuỗi nguồn có khớp với mẫu biểu thức chính quy Regex hay không.",
    useWhen: ["Dùng để xác thực định dạng dữ liệu nâng cao (ví dụ: kiểm tra xem định dạng email, số điện thoại có đúng chuẩn không)."],
    fields: [
      { name: "Source variable", description: "Biến chuỗi nguồn.", details: [] },
      { name: "Regex pattern", description: "Mẫu Regex dùng để so khớp.", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Source: email, Regex: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', Result: is_valid_email"],
    commonMistakes: ["Viết sai cú pháp Regex hoặc quên không thoát các ký tự đặc biệt."],
  },
  update_flag_variable: {
    title: "Trợ giúp Cập nhật Biến Cờ (Update Flag Variable)",
    summary: "Cập nhật hoặc đảo ngược giá trị của một biến boolean (flag).",
    useWhen: ["Dùng để bật/tắt trạng thái chạy trong workflow (ví dụ: đảo trạng thái biến is_running)."],
    fields: [
      { name: "Variable name", description: "Tên biến flag cần cập nhật.", details: [] },
      { name: "Operation", description: "Thao tác cập nhật (toggle - đảo giá trị, set_true - gán true, set_false - gán false).", details: [] }
    ],
    examples: ["Variable name: is_checked, Operation: toggle để chuyển true thành false hoặc ngược lại."],
    commonMistakes: ["Cập nhật trên biến không phải kiểu boolean, có thể gây ra kết quả không mong đợi."],
  },
  set_boolean_variable: {
    title: "Trợ giúp Đặt biến Boolean (Set Boolean Variable)",
    summary: "Đặt trực tiếp giá trị True hoặc False cho một biến cờ.",
    useWhen: ["Dùng để khởi tạo các biến cờ trạng thái tĩnh."],
    fields: [
      { name: "Result variable", description: "Tên biến kết quả cần lưu.", details: [] },
      { name: "Value", description: "Giá trị boolean cần đặt (true hoặc false).", details: [] }
    ],
    examples: ["Result variable: is_logged_in, Value: true"],
    commonMistakes: ["Nhập chuỗi văn bản không chuẩn (ví dụ 'yes', 'no') khiến việc chuyển đổi kiểu dữ liệu bị sai."],
  },
  generate_random_boolean: {
    title: "Trợ giúp Tạo Boolean Ngẫu nhiên (Generate Random Boolean)",
    summary: "Tạo ngẫu nhiên một giá trị True hoặc False dựa trên xác suất cấu hình.",
    useWhen: ["Dùng để ngẫu nhiên hóa quyết định rẽ nhánh trong kiểm thử hoặc cào dữ liệu bot."],
    fields: [
      { name: "Result variable", description: "Tên biến đầu ra để lưu kết quả.", details: [] },
      { name: "Probability", description: "Xác suất nhận giá trị true (từ 0.0 đến 1.0, mặc định là 0.5 tức 50%).", details: [] }
    ],
    examples: ["Result variable: decision, Probability: 0.3 (30% cơ hội nhận true)."],
    commonMistakes: ["Đặt xác suất ngoài khoảng cho phép từ 0.0 đến 1.0 (ví dụ nhập 30 thay vì 0.3)."],
  },
  parse_to_boolean: {
    title: "Trợ giúp Chuyển đổi sang Boolean (Parse to Boolean)",
    summary: "Chuyển đổi chuỗi văn bản hoặc số thành giá trị kiểu boolean thực sự.",
    useWhen: ["Dùng để parse các giá trị như 'yes'/'no', '1'/'0' thu được từ giao diện web thành boolean."],
    fields: [
      { name: "Source value to convert", description: "Giá trị nguồn cần chuyển.", details: [] },
      { name: "Fallback value", description: "Giá trị mặc định trả về nếu parse thất bại.", details: [] },
      { name: "Result variable", description: "Tên biến đầu ra lưu kết quả.", details: [] }
    ],
    examples: ["Source: {{raw_status}}, Fallback: false, Result: is_active"],
    commonMistakes: ["Để giá trị fallback không phải là boolean hợp lệ (true/false)."],
  },
  boolean_logical_op: {
    title: "Trợ giúp Phép toán Logic Boolean (Boolean Logical Op)",
    summary: "Thực hiện phép toán logic (AND, OR, NOT, XOR) trên các giá trị boolean.",
    useWhen: ["Dùng khi cần kết hợp kết quả kiểm tra của nhiều điều kiện boolean trước khi đưa ra quyết định rẽ nhánh."],
    fields: [
      { name: "First operand", description: "Toán hạng boolean thứ nhất.", details: [] },
      { name: "Logical Operation", description: "Phép toán logic (AND, OR, NOT, XOR).", details: [] },
      { name: "Second operand", description: "Toán hạng boolean thứ hai (bỏ qua đối với phép NOT).", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả.", details: [] }
    ],
    examples: ["First: {{has_cookie}}, Operator: AND, Second: {{is_logged_in}}, Result: is_valid_session"],
    commonMistakes: ["Truyền các biến chứa dữ liệu kiểu chuỗi hoặc số mà không parse thành boolean trước."],
  },
  compare_booleans: {
    title: "Trợ giúp So sánh Boolean (Compare Booleans)",
    summary: "So sánh xem hai giá trị boolean có bằng nhau hay khác nhau không.",
    useWhen: ["Dùng để kiểm tra xem hai cờ trạng thái có cùng trạng thái hoạt động hay không."],
    fields: [
      { name: "First operand", description: "Giá trị boolean thứ nhất.", details: [] },
      { name: "Operator", description: "Toán tử so sánh (bằng hoặc khác).", details: [] },
      { name: "Second operand", description: "Giá trị boolean thứ hai.", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["First: {{is_user_active}}, Operator: eq, Second: {{is_db_active}}, Result: is_sync"],
    commonMistakes: ["So sánh trực tiếp giá trị boolean với chuỗi văn bản 'true'/'false'."],
  },
  check_boolean_property: {
    title: "Trợ giúp Kiểm tra Thuộc tính Boolean (Check Boolean Property)",
    summary: "Xác minh trực tiếp xem một biến boolean là True hay False.",
    useWhen: ["Dùng để xuất nhanh kết quả kiểm tra biến cờ sang biến khác."],
    fields: [
      { name: "Source value", description: "Biến boolean cần kiểm tra.", details: [] },
      { name: "Property", description: "Thuộc tính kiểm tra (is_true hoặc is_false).", details: [] },
      { name: "Result variable", description: "Biến lưu kết quả boolean.", details: [] }
    ],
    examples: ["Source: {{is_admin}}, Property: is_true, Result: has_admin_access"],
    commonMistakes: ["Chạy kiểm tra trên biến không phải kiểu boolean."],
  },
};
