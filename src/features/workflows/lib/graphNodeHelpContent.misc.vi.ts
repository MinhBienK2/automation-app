import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const miscNodesVi: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  transform_variable: {
    title: "Trợ giúp Chuyển đổi Biến (Transform Variable)",
    summary: "Tạo một biến đầu ra mới từ các biến đã có sẵn bằng cách áp dụng biểu thức biến đổi.",
    useWhen: ["Dùng khi muốn định dạng lại nhanh, nhân hệ số hoặc biến đổi nhẹ giá trị của biến trước khi đi tiếp."],
    fields: [
      {
        name: "Source output",
        description: "Tên biến đầu vào cần xử lý.",
        details: ["Biến này phải được tạo ra ở các bước chạy trước đó."]
      },
      {
        name: "Target output",
        description: "Tên của biến đầu ra mới nhận giá trị sau biến đổi.",
        details: ["Các node sau có thể đọc giá trị qua tên biến mới này."]
      },
      {
        name: "Expression",
        description: "Biểu thức biến đổi giá trị.",
        details: [
          "Giữ biểu thức đơn giản, sử dụng dấu ngoặc nhọn {{}} để đại diện cho biến nguồn.",
          "Ví dụ: {{price}} * 2."
        ]
      }
    ],
    examples: ["Source: product_price, Target: discount_price, Expression: {{product_price}} * 0.9"],
    commonMistakes: ["Thiếu dấu ngoặc nhọn {{}} xung quanh tên biến nguồn trong biểu thức Expression, làm node hiểu nhầm là chuỗi văn bản tĩnh."],
  },
  assert_output: {
    title: "Trợ giúp Khẳng định Kết quả (Assert Output)",
    summary: "Bắt buộc một biến đầu ra phải khớp chính xác hoặc chứa một giá trị mong đợi.",
    useWhen: ["Dùng để chốt kiểm thử (assertion), nếu điều kiện mong đợi sai, workflow sẽ lập tức dừng và báo lỗi."],
    fields: [
      {
        name: "Output name",
        description: "Tên biến cần kiểm tra giá trị.",
        details: ["Biến phải tồn tại trước khi chạy kiểm tra."]
      },
      {
        name: "Match",
        description: "Cách thức so sánh (Equals - khớp chính xác hoàn toàn; Contains - chuỗi chỉ cần chứa đoạn text).",
        details: ["Nên dùng Contains cho các chuỗi văn bản dài hoặc có chứa một phần thay đổi động."]
      },
      {
        name: "Expected value",
        description: "Giá trị mong đợi cần khớp.",
        details: ["Hãy kiểm tra kỹ cả khoảng trắng và sự phân biệt chữ hoa/chữ thường."]
      }
    ],
    examples: ["Output name: register_status, Match: Equals, Expected: 'success'"],
    commonMistakes: ["So khớp lệch ký tự viết hoa/thường hoặc thừa khoảng trắng ở cuối Expected value, làm assert bị fail không đáng có."],
  },
  domain_allowlist: {
    title: "Trợ giúp Danh sách Tên miền Cho phép (Domain Allowlist)",
    summary: "Giới hạn trình duyệt chỉ được phép truy cập và chạy trong phạm vi các tên miền được khai báo.",
    useWhen: ["Dùng để bảo vệ an toàn chạy tự động, ngăn bot bị lừa chuyển hướng sang các trang web giả mạo hoặc độc hại."],
    fields: [
      {
        name: "Allowed domains",
        description: "Danh sách các tên miền cho phép, viết mỗi dòng một tên miền.",
        details: [
          "Chỉ điền tên miền máy chủ (host), không điền giao thức hay đường dẫn dẫn (ví dụ: điền 'example.com', không điền 'https://example.com/path').",
          "Nếu trình duyệt tự động chuyển sang trang có tên miền ngoài allowlist, workflow sẽ bị hệ thống chặn dừng ngay lập tức."
        ]
      }
    ],
    examples: ["Allowed domains: github.com\\ngoogle.com"],
    commonMistakes: ["Điền cả giao thức 'https://' hoặc đường dẫn URL chi tiết vào danh sách, làm bộ lọc tên miền hoạt động không đúng."],
  },
  get_current_url: {
    title: "Trợ giúp Lấy URL Hiện Tại (Get Current URL)",
    summary: "Truy xuất địa chỉ URL của trang web hiện tại và lưu vào biến system.current_url.",
    useWhen: ["Dùng khi cần phân tích tham số truy vấn (query params) hoặc xác thực xem trình duyệt đã điều hướng đúng trang mong muốn chưa."],
    fields: [
      {
        name: "Output",
        description: "Dữ liệu URL đầy đủ được lưu vào biến hệ thống system.current_url.",
        details: [
          "Không cần cấu hình thêm trường nhập liệu.",
          "Cổng Out truyền luồng chạy tiếp tục."
        ]
      }
    ],
    examples: ["Nối Get Current URL sau thao tác Click chuyển trang, rồi dùng If để check system.current_url.pathname."],
    commonMistakes: ["Chạy lấy URL khi trang web chưa tải xong hoặc đang trong quá trình chuyển hướng, làm URL lấy được bị cũ hoặc rỗng."],
  },
  quarantined: {
    title: "Trợ giúp Cách ly (Quarantined)",
    summary: "Đánh dấu nút đang bị cách ly do không đúng định dạng schema hoặc phiên bản app hiện tại không hỗ trợ.",
    useWhen: ["Nút tự động xuất hiện trên canvas khi bạn nạp một workflow cũ chứa các cấu hình node lỗi thời."],
    fields: [
      {
        name: "Trạng thái",
        description: "Nút bị vô hiệu hóa để tham khảo cấu hình cũ nhưng không được biên dịch hay thực thi.",
        details: ["Cần sửa đổi hoặc thay thế nút này bằng nút chức năng mới trước khi chạy."]
      }
    ],
    examples: ["Không có ví dụ chạy. Nút đóng vai trò cảnh báo trực quan trên canvas."],
    commonMistakes: ["Bỏ quên nút bị cách ly trên graph làm gián đoạn luồng biên dịch workflow."],
  },
};
