import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const vietnameseGraphNodeHelpContent: Record<GraphNodeType, GraphNodeHelpContent> = {
  start: {
    title: "Start Help",
    summary: "Bắt đầu workflow graph.",
    useWhen: ["Dùng như điểm điều hướng rõ ràng trong graph."],
    fields: [
      {
        name: "Ports",
        description: "Node này chủ yếu được cấu hình bằng cách nối các port trên canvas.",
        details: [
          "Input port nhận luồng chạy từ node trước.",
          "Output port quyết định workflow đi tiếp theo nhánh nào.",
          "Port bắt buộc thiếu link sẽ chặn validate/run; port optional thiếu link sẽ no-op hoặc kết thúc nhánh thành công.",
        ],
      },
    ],
    examples: ["Start: nối port để điều hướng flow."],
    commonMistakes: ["Xóa hoặc bỏ nối node quan trọng làm graph không còn reachable."],
  },
  end_success: {
    title: "Success End Help",
    summary: "Kết thúc workflow thành công.",
    useWhen: ["Dùng như điểm điều hướng rõ ràng trong graph."],
    fields: [
      {
        name: "Ports",
        description: "Node này chủ yếu được cấu hình bằng cách nối các port trên canvas.",
        details: [
          "Input port nhận luồng chạy từ node trước.",
          "Output port quyết định workflow đi tiếp theo nhánh nào.",
          "Port bắt buộc thiếu link sẽ chặn validate/run; port optional thiếu link sẽ no-op hoặc kết thúc nhánh thành công.",
        ],
      },
    ],
    examples: ["Success End: nối port để điều hướng flow."],
    commonMistakes: ["Xóa hoặc bỏ nối node quan trọng làm graph không còn reachable."],
  },
  end_failure: {
    title: "End Failure Help",
    summary: "Kết thúc workflow với trạng thái thất bại và lý do rõ ràng.",
    useWhen: ["Dùng ở nhánh lỗi có chủ đích.", "Dùng khi graph phát hiện điều kiện không thể tiếp tục."],
    fields: [
      {
        name: "Failure reason",
        description: "Thông báo lỗi sẽ hiện khi workflow kết thúc tại node này.",
        details: ["Viết ngắn gọn nhưng đủ để người dùng biết nhánh nào đã fail.", "Reason này đi vào trạng thái run failed."],
      },
    ],
    examples: ["Failure reason: Login failed after retry"],
    commonMistakes: ["Không nối nhánh lỗi tới node này nên workflow không bao giờ tới failure end."],
  },
  action: {
    title: "Action Node Help",
    summary: "Chạy một action cụ thể. Sau khi chọn Action type, popup help sẽ dùng nội dung chi tiết của action đó.",
    useWhen: ["Dùng cho các thao tác browser, data, session, network, reliability, hoặc advanced."],
    fields: [
      {
        name: "Action type",
        description: "Loại action sẽ chạy ở node này.",
        details: ["Chọn action type trước khi run.", "Khi đổi action type, config action được reset về default của type mới."],
      },
    ],
    examples: ["Action type: Click, XPath: //*[@type='submit']"],
    commonMistakes: ["Để New node chưa chọn action type; graph vẫn lưu được nhưng validate/run sẽ bị chặn."],
  },
  call_subflow: {
    title: "Call Subflow Help",
    summary: "Chạy một subflow cùng project trong cùng browser context và output store.",
    useWhen: ["Dùng để tái sử dụng đường graph đã chuẩn hóa như login hoặc setup account state."],
    fields: [
      {
        name: "Subflow id",
        description: "Subflow trong cùng project sẽ được gọi.",
        details: [
          "Subflow khác project hoặc bị xóa sẽ chặn validate/run.",
          "Subflow graph không được chứa Call Subflow trong MVP.",
        ],
      },
      {
        name: "Input mapping",
        description: "Danh sách input_name=value truyền vào subflow trước khi chạy.",
        details: [
          "Mỗi dòng ánh xạ một input.",
          "Value có thể dùng template output giống các field text khác.",
        ],
      },
      {
        name: "Output prefix",
        description: "Prefix tùy chọn cho output do subflow tạo.",
        details: [
          "Dùng khi nhiều lần gọi cùng một subflow và cần phân biệt output.",
        ],
      },
    ],
    examples: ["Subflow id: subflow-login", "Input mapping: email={{account.email}}"],
    commonMistakes: ["Gọi subflow thuộc project khác.", "Để trống Subflow id rồi validate/run."],
  },
  merge: {
    title: "Merge Help",
    summary: "Cho nhiều nhánh quay về một luồng chung mà không chờ nhánh khác.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Ports",
        description: "Nối nhiều nhánh vào In và một continuation từ Out.",
        details: [
          "Merge không chạy browser action.",
          "Nhánh nào tới Merge sẽ đi tiếp qua Out; nếu Out bỏ trống thì path kết thúc thành công.",
        ],
      },
    ],
    examples: ["Merge: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  router: {
    title: "Router Help",
    summary: "Chọn case đầu tiên khớp trong bảng điều kiện ưu tiên.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Condition",
        description: "Điều kiện dùng để quyết định nhánh hoặc vòng lặp.",
        details: [
          "Output equals/contains kiểm tra output đã tạo trước đó.",
          "Text visible, URL contains, Element visible kiểm tra trạng thái trang hiện tại.",
          "Nếu condition dựa trên output, hãy chắc chắn output đó được tạo trước node logic này.",
        ],
      },
      {
        name: "Done port",
        description: "Continuation sau khi branch được chọn hoàn tất.",
        details: [
          "Done optional; nếu không nối, workflow kết thúc thành công sau Router.",
        ],
      },
    ],
    examples: ["Router: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  random_choice: {
    title: "Random Choice Help",
    summary: "Chọn ngẫu nhiên một nhánh theo weight đã cấu hình.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Choices",
        description: "Danh sách các nhánh có label và weight riêng.",
        details: [
          "Weight càng cao thì nhánh càng có khả năng được chọn.",
          "Branch bỏ trống sẽ no-op nếu được chọn.",
        ],
      },
      {
        name: "Output name",
        description: "Tên output nhận id choice đã được chọn.",
        details: [
          "Dùng output này để audit hoặc branch tiếp bằng Switch/Router.",
          "Done port chạy sau khi branch được chọn hoàn tất.",
        ],
      },
    ],
    examples: ["Random Choice: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  if: {
    title: "If Help",
    summary: "Rẽ workflow sang nhánh True hoặc False dựa trên một condition.",
    useWhen: ["Dùng khi workflow cần quyết định đường đi theo output, text, URL, hoặc element.", "Dùng cho logic như đã đăng nhập/chưa đăng nhập, có dữ liệu/không có dữ liệu."],
    fields: [
      {
        name: "Condition",
        description: "Điều kiện dùng để quyết định nhánh hoặc vòng lặp.",
        details: [
          "Output equals/contains kiểm tra output đã tạo trước đó.",
          "Text visible, URL contains, Element visible kiểm tra trạng thái trang hiện tại.",
          "Nếu condition dựa trên output, hãy chắc chắn output đó được tạo trước node logic này.",
        ],
      },
      {
        name: "True port",
        description: "Nhánh chạy khi condition đúng.",
        details: ["True branch is optional; missing link will no-op.", "Nối các action cần chạy khi điều kiện khớp vào port này."],
      },
      {
        name: "False port",
        description: "Nhánh chạy khi condition sai.",
        details: ["False branch is optional; missing link will no-op.", "Dùng cho fallback, thông báo lỗi, hoặc đường xử lý khác."],
      },
      {
        name: "Done port",
        description: "Luồng tiếp tục sau khi nhánh True/False hoàn tất.",
        details: ["Done continuation is optional; workflow ends successfully here.", "Nối vào đây nếu cả hai nhánh đều cần quay lại flow chính."],
      },
    ],
    examples: ["Condition: Output equals logged_in = true; True -> dashboard actions; False -> login actions; Done -> extract result"],
    commonMistakes: ["Nối step tiếp theo vào True/False thay vì Done, làm flow chỉ chạy ở một nhánh.", "Đặt condition theo output chưa được tạo trước đó."],
  },
  switch: {
    title: "Switch Help",
    summary: "Chọn một nhánh theo giá trị expression và danh sách cases.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Switch expression",
        description: "Giá trị hoặc tên output dùng để so với các case.",
        details: ["Thường là tên output đã được extract/set trước đó."],
      },
      {
        name: "Switch cases",
        description: "Mỗi dòng là một case và tạo một output port tương ứng.",
        details: ["Default port chạy khi không case nào khớp.", "Done port là continuation sau khi case branch hoàn tất."],
      },
    ],
    examples: ["Switch: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  repeat_times: {
    title: "Repeat Times Help",
    summary: "Lặp body một số lần cố định.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Times",
        description: "Số lần chạy body.",
        details: ["Phải lớn hơn 0.", "Body port là phần được lặp; Done port chạy sau khi lặp xong."],
      },
    ],
    examples: ["Repeat Times: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  repeat_for_each: {
    title: "Repeat For Each Help",
    summary: "Lặp body cho từng item trong danh sách.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Item name",
        description: "Tên biến đại diện item hiện tại.",
        details: ["Dùng tên dễ hiểu như product, row, email."],
      },
      {
        name: "Items",
        description: "Danh sách item, mỗi dòng một giá trị.",
        details: ["Body chạy một lần cho mỗi dòng không trống.", "Done chạy sau item cuối cùng."],
      },
    ],
    examples: ["Repeat For Each: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  repeat_until: {
    title: "Repeat Until Help",
    summary: "Lặp body cho tới khi condition đúng hoặc chạm giới hạn.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Condition",
        description: "Điều kiện dùng để quyết định nhánh hoặc vòng lặp.",
        details: [
          "Output equals/contains kiểm tra output đã tạo trước đó.",
          "Text visible, URL contains, Element visible kiểm tra trạng thái trang hiện tại.",
          "Nếu condition dựa trên output, hãy chắc chắn output đó được tạo trước node logic này.",
        ],
      },
      {
        name: "Loop max attempts",
        description: "Số lần lặp tối đa để tránh vòng lặp vô hạn.",
        details: ["Phải lớn hơn 0.", "Tăng vừa đủ theo dữ liệu thực tế."],
      },
      {
        name: "Loop timeout ms",
        description: "Thời gian tối đa cho loop.",
        details: ["0 hoặc trống nghĩa là không đặt timeout riêng khi được hỗ trợ.", "Body port là phần được lặp; Done port chạy sau loop."],
      },
    ],
    examples: ["Repeat Until: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  while: {
    title: "While Help",
    summary: "Lặp body khi condition còn đúng.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Condition",
        description: "Điều kiện dùng để quyết định nhánh hoặc vòng lặp.",
        details: [
          "Output equals/contains kiểm tra output đã tạo trước đó.",
          "Text visible, URL contains, Element visible kiểm tra trạng thái trang hiện tại.",
          "Nếu condition dựa trên output, hãy chắc chắn output đó được tạo trước node logic này.",
        ],
      },
      {
        name: "Loop max attempts",
        description: "Số lần lặp tối đa để tránh vòng lặp vô hạn.",
        details: ["Phải lớn hơn 0.", "Tăng vừa đủ theo dữ liệu thực tế."],
      },
      {
        name: "Loop timeout ms",
        description: "Thời gian tối đa cho loop.",
        details: ["0 hoặc trống nghĩa là không đặt timeout riêng khi được hỗ trợ.", "Body port là phần được lặp; Done port chạy sau loop."],
      },
    ],
    examples: ["While: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  retry: {
    title: "Retry Help",
    summary: "Thử lại nhánh Try khi nó fail.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Max attempts",
        description: "Số lần thử tối đa.",
        details: ["Try port là bắt buộc trước khi run.", "Success port chạy khi Try thành công."],
      },
      {
        name: "Delay ms",
        description: "Thời gian nghỉ giữa các lần retry.",
        details: ["Failed port optional; nếu thiếu và retry hết lần, workflow fail."],
      },
    ],
    examples: ["Retry: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  try_catch: {
    title: "Try Catch Help",
    summary: "Tách luồng chạy thường, lỗi, và cleanup.",
    useWhen: ["Dùng khi control flow cần hành vi này."],
    fields: [
      {
        name: "Ports",
        description: "Node này chủ yếu được cấu hình bằng cách nối các port trên canvas.",
        details: [
          "Input port nhận luồng chạy từ node trước.",
          "Output port quyết định workflow đi tiếp theo nhánh nào.",
          "Port bắt buộc thiếu link sẽ chặn validate/run; port optional thiếu link sẽ no-op hoặc kết thúc nhánh thành công.",
        ],
      },
    ],
    examples: ["Try Catch: nối các port được đặt tên trên canvas."],
    commonMistakes: ["Để node ngoài ngữ cảnh hợp lệ, ví dụ break/continue bên ngoài loop body."],
  },
  fallback: {
    title: "Fallback Help",
    summary: "Thử primary trước, nếu fail thì chạy fallback.",
    useWhen: ["Dùng khi control flow cần hành vi này."],
    fields: [
      {
        name: "Ports",
        description: "Node này chủ yếu được cấu hình bằng cách nối các port trên canvas.",
        details: [
          "Input port nhận luồng chạy từ node trước.",
          "Output port quyết định workflow đi tiếp theo nhánh nào.",
          "Port bắt buộc thiếu link sẽ chặn validate/run; port optional thiếu link sẽ no-op hoặc kết thúc nhánh thành công.",
        ],
      },
    ],
    examples: ["Fallback: nối các port được đặt tên trên canvas."],
    commonMistakes: ["Để node ngoài ngữ cảnh hợp lệ, ví dụ break/continue bên ngoài loop body."],
  },
  break_loop: {
    title: "Break Loop Help",
    summary: "Thoát khỏi vòng lặp hiện tại.",
    useWhen: ["Dùng khi control flow cần hành vi này."],
    fields: [
      {
        name: "Ports",
        description: "Node này chủ yếu được cấu hình bằng cách nối các port trên canvas.",
        details: [
          "Input port nhận luồng chạy từ node trước.",
          "Output port quyết định workflow đi tiếp theo nhánh nào.",
          "Port bắt buộc thiếu link sẽ chặn validate/run; port optional thiếu link sẽ no-op hoặc kết thúc nhánh thành công.",
        ],
      },
    ],
    examples: ["Break Loop: nối các port được đặt tên trên canvas."],
    commonMistakes: ["Để node ngoài ngữ cảnh hợp lệ, ví dụ break/continue bên ngoài loop body."],
  },
  continue_loop: {
    title: "Continue Loop Help",
    summary: "Bỏ qua phần còn lại của iteration hiện tại.",
    useWhen: ["Dùng khi control flow cần hành vi này."],
    fields: [
      {
        name: "Ports",
        description: "Node này chủ yếu được cấu hình bằng cách nối các port trên canvas.",
        details: [
          "Input port nhận luồng chạy từ node trước.",
          "Output port quyết định workflow đi tiếp theo nhánh nào.",
          "Port bắt buộc thiếu link sẽ chặn validate/run; port optional thiếu link sẽ no-op hoặc kết thúc nhánh thành công.",
        ],
      },
    ],
    examples: ["Continue Loop: nối các port được đặt tên trên canvas."],
    commonMistakes: ["Để node ngoài ngữ cảnh hợp lệ, ví dụ break/continue bên ngoài loop body."],
  },
  stop_workflow: {
    title: "Stop Workflow Help",
    summary: "Dừng workflow có chủ đích với success hoặc failure.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Status",
        description: "Trạng thái kết thúc: Success hoặc Failure.",
        details: ["Success kết thúc hợp lệ; Failure đánh dấu run thất bại."],
      },
      {
        name: "Reason",
        description: "Lý do dừng workflow.",
        details: ["Nên viết rõ để người dùng hiểu vì sao flow dừng."],
      },
    ],
    examples: ["Stop Workflow: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  set_variable: {
    title: "Set Variables Help",
    summary: "Lưu nhiều giá trị để các node sau dùng lại.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Rows",
        description: "Mỗi dòng có Name, Type và Value.",
        details: ["Type phân biệt text, JSON, number và boolean."],
      },
      {
        name: "Name",
        description: "Tên biến hoặc dot-path cần lưu.",
        details: ["Dùng user.name để tạo biến có path rõ ràng."],
      },
    ],
    examples: ["Set Variables: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  set_json_variables: {
    title: "Set JSON Variables Help",
    summary: "Lưu biến từ một JSON object.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "JSON variables",
        description: "JSON root phải là object.",
        details: ["Object lồng nhau được flatten thành dot-path; array giữ nguyên."],
      },
    ],
    examples: ["Set JSON Variables: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  check_conditions: {
    title: "Kiểm tra điều kiện Help",
    summary: "Đánh giá các quy tắc logic trực quan hoặc mã JS và lưu kết quả dạng True/False.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "Tên biến lưu kết quả.",
        details: ["Kết quả lưu dưới dạng boolean true hoặc false."],
      },
      {
        name: "Evaluation Mode",
        description: "Chọn chế độ visual rules hoặc viết mã JS.",
        details: ["Mã JS chạy trên ngữ cảnh browser và nhận outputs.", "Dùng {{name}} để chèn biến, hoặc outputs.name để truy cập trực tiếp."],
      },
    ],
    examples: ["Kiểm tra điều kiện: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  calculate_value: {
    title: "Tính toán giá trị Help",
    summary: "Đánh giá một biểu thức JavaScript/Toán học và lưu kết quả thực tế (số, chuỗi, v.v.).",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "Tên biến lưu kết quả.",
        details: ["Kết quả lưu dưới dạng giá trị thực tế sau tính toán."],
      },
      {
        name: "JavaScript / Math Expression",
        description: "Biểu thức cần tính toán.",
        details: ["Biểu thức chạy trên ngữ cảnh browser và nhận outputs.", "Dùng {{name}} hoặc outputs.name để tham chiếu biến."],
      },
    ],
    examples: ["Tính toán giá trị: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  update_number_variable: {
    title: "Cập nhật biến số Help",
    summary: "Thực hiện phép toán (cộng, trừ, nhân, chia, tăng, giảm) trên một biến số.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      { name: "Variable name", description: "Tên biến số cần cập nhật.", details: [] },
      { name: "Operation", description: "Phép toán cần thực hiện.", details: [] },
      { name: "Value", description: "Giá trị toán hạng (đối với add, subtract, multiply, divide).", details: [] },
    ],
    examples: ["Cập nhật biến số: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  update_text_variable: {
    title: "Cập nhật biến chữ Help",
    summary: "Thực hiện xử lý chuỗi (thêm đầu, thêm cuối, thay thế, viết hoa, viết thường, cắt khoảng trắng) trên một biến chữ.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      { name: "Variable name", description: "Tên biến chữ cần cập nhật.", details: [] },
      { name: "Operation", description: "Thao tác chuỗi cần thực hiện.", details: [] },
      { name: "Search pattern", description: "Mẫu tìm kiếm (chuỗi hoặc regex) khi thay thế.", details: [] },
      { name: "Value", description: "Giá trị chèn thêm hoặc giá trị thay thế.", details: [] },
    ],
    examples: ["Cập nhật biến chữ: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  update_flag_variable: {
    title: "Cập nhật biến flag Help",
    summary: "Cập nhật giá trị boolean (toggle, set true, set false) cho một biến flag.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      { name: "Variable name", description: "Tên biến flag cần cập nhật.", details: [] },
      { name: "Operation", description: "Thao tác boolean (toggle, set_true, set_false).", details: [] },
    ],
    examples: ["Cập nhật biến flag: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  update_list_variable: {
    title: "Cập nhật biến danh sách Help",
    summary: "Thao tác với mảng (thêm, xóa phần tử, loại bỏ trùng lặp, gộp mảng).",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      { name: "Variable name", description: "Tên biến danh sách cần cập nhật.", details: [] },
      { name: "Operation", description: "Thao tác mảng (push, unshift, push_unique, pop, shift, remove_by_index, remove_by_value, merge, merge_unique).", details: [] },
      { name: "Value type", description: "Kiểu dữ liệu của phần tử mới.", details: [] },
      { name: "Value", description: "Giá trị phần tử cần thêm hoặc xóa.", details: [] },
      { name: "Index", description: "Chỉ số phần tử cần xóa (dành cho remove_by_index).", details: [] },
    ],
    examples: ["Cập nhật biến danh sách: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  create_empty_list: {
    title: "Tạo danh sách rỗng Help",
    summary: "Khởi tạo một biến danh sách rỗng.",
    useWhen: ["Khởi tạo một mảng sạch trước khi thực hiện các thao tác mảng khác."],
    fields: [
      { name: "Output variable name", description: "Tên của biến danh sách rỗng cần tạo.", details: [] },
    ],
    examples: ["Tạo danh sách rỗng: cấu hình tên biến đầu ra trong inspector."],
    commonMistakes: ["Để trống tên biến đầu ra."],
  },
  create_list_manual: {
    title: "Tạo danh sách thủ công Help",
    summary: "Khởi tạo một danh sách với các phần tử thủ công.",
    useWhen: ["Khởi tạo một mảng với một tập hợp các giá trị tĩnh được cấu hình sẵn."],
    fields: [
      { name: "Output variable name", description: "Tên của biến danh sách cần tạo.", details: [] },
      { name: "Item value type", description: "Kiểu dữ liệu của các phần tử trong danh sách.", details: [] },
      { name: "List items", description: "Các phần tử tĩnh để đưa vào danh sách (mỗi dòng một phần tử).", details: [] },
    ],
    examples: ["Tạo danh sách thủ công: cấu hình các phần tử trong inspector."],
    commonMistakes: ["Để trống danh sách phần tử."],
  },
  split_text_to_list: {
    title: "Tách văn bản thành danh sách Help",
    summary: "Tách một chuỗi văn bản thành danh sách bằng ký tự phân tách.",
    useWhen: ["Chuyển đổi một chuỗi cách nhau bởi dấu phẩy hoặc ký tự phân tách khác thành một mảng."],
    fields: [
      { name: "Output variable name", description: "Tên của biến danh sách cần tạo.", details: [] },
      { name: "Source text to split", description: "Nội dung văn bản nguồn cần tách.", details: [] },
      { name: "Delimiter", description: "Ký tự phân tách văn bản.", details: [] },
    ],
    examples: ["Tách văn bản thành danh sách: cấu hình văn bản nguồn và ký tự phân tách."],
    commonMistakes: ["Sử dụng ký tự phân tách không khớp với định dạng văn bản nguồn."],
  },
  generate_number_range: {
    title: "Tạo dãy số Help",
    summary: "Tạo một danh sách các số từ bắt đầu đến kết thúc.",
    useWhen: ["Tạo một chuỗi số cho vòng lặp hoặc các dịch chuyển trang."],
    fields: [
      { name: "Output variable name", description: "Tên của biến danh sách cần tạo.", details: [] },
      { name: "Start value", description: "Số bắt đầu.", details: [] },
      { name: "End value", description: "Số kết thúc (bao gồm cả số này).", details: [] },
      { name: "Step size", description: "Bước nhảy tăng số.", details: [] },
    ],
    examples: ["Tạo dãy số: cấu hình số bắt đầu và kết thúc."],
    commonMistakes: ["Đặt bước nhảy vô hạn hoặc sai hướng."],
  },
  add_to_list: {
    title: "Thêm vào danh sách Help",
    summary: "Thêm một giá trị vào đầu, cuối hoặc thêm duy nhất vào danh sách.",
    useWhen: ["Thêm các phần tử một cách linh hoạt trong quá trình thực thi."],
    fields: [
      { name: "Target list variable name", description: "Tên của danh sách cần thêm vào.", details: [] },
      { name: "Add position", description: "Vị trí thêm phần tử vào danh sách.", details: [] },
      { name: "Value type", description: "Kiểu dữ liệu của giá trị cần thêm.", details: [] },
      { name: "Value to add", description: "Giá trị cần chèn.", details: [] },
    ],
    examples: ["Thêm vào danh sách: cấu hình tên danh sách và giá trị."],
    commonMistakes: ["Thêm vào một biến không phải là danh sách."],
  },
  remove_from_list_by_index: {
    title: "Xóa khỏi danh sách bằng index Help",
    summary: "Xóa một phần tử khỏi danh sách bằng chỉ số (index).",
    useWhen: ["Xóa phần tử ở một vị trí cụ thể."],
    fields: [
      { name: "Target list variable name", description: "Tên danh sách cần sửa đổi.", details: [] },
      { name: "Index", description: "Vị trí bắt đầu từ 0 cần xóa.", details: [] },
    ],
    examples: ["Xóa khỏi danh sách bằng index: cấu hình tên danh sách và chỉ số."],
    commonMistakes: ["Cung cấp chỉ số vượt quá phạm vi danh sách."],
  },
  remove_from_list_by_value: {
    title: "Xóa khỏi danh sách bằng giá trị Help",
    summary: "Xóa các phần tử khỏi danh sách khớp với một giá trị.",
    useWhen: ["Xóa các phần tử khớp cụ thể khỏi danh sách."],
    fields: [
      { name: "Target list variable name", description: "Tên danh sách cần sửa đổi.", details: [] },
      { name: "Value type", description: "Kiểu dữ liệu của giá trị cần xóa.", details: [] },
      { name: "Value to match for removal", description: "Giá trị cần lọc bỏ.", details: [] },
    ],
    examples: ["Xóa khỏi danh sách bằng giá trị: cấu hình giá trị cần xóa."],
    commonMistakes: ["Kiểu giá trị cần xóa không khớp."],
  },
  merge_lists: {
    title: "Gộp danh sách Help",
    summary: "Gộp một danh sách khác hoặc một tập hợp các giá trị vào danh sách.",
    useWhen: ["Kết hợp nhiều mảng hoặc thêm nhiều giá trị."],
    fields: [
      { name: "Target list variable name", description: "Tên của danh sách cần gộp vào.", details: [] },
      { name: "List to merge", description: "Biến mảng hoặc mảng JSON cần gộp.", details: [] },
      { name: "Merge unique items only", description: "Có tránh các phần tử trùng lặp hay không.", details: [] },
    ],
    examples: ["Gộp danh sách: cấu hình các danh sách cần gộp."],
    commonMistakes: ["Gộp một biến không phải là danh sách."],
  },
  get_list_item: {
    title: "Lấy phần tử danh sách Help",
    summary: "Lấy một phần tử duy nhất từ danh sách theo index hoặc vị trí.",
    useWhen: ["Trích xuất một phần tử cụ thể từ danh sách."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Position", description: "Vị trí của phần tử cần lấy.", details: [] },
      { name: "Index", description: "Chỉ số cụ thể bắt đầu từ 0 cần lấy.", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu trữ phần tử.", details: [] },
    ],
    examples: ["Lấy phần tử danh sách: cấu hình danh sách nguồn và chỉ số."],
    commonMistakes: ["Cung cấp chỉ số vượt quá phạm vi danh sách."],
  },
  get_list_length: {
    title: "Lấy độ dài danh sách Help",
    summary: "Lấy số lượng phần tử trong danh sách.",
    useWhen: ["Kiểm tra kích thước danh sách cho các vòng lặp hoặc xác nhận."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu trữ độ dài.", details: [] },
    ],
    examples: ["Lấy độ dài danh sách: cấu hình danh sách nguồn và đầu ra."],
    commonMistakes: ["Đo độ dài của một biến không phải danh sách."],
  },
  slice_list: {
    title: "Cắt danh sách Help",
    summary: "Lấy một danh sách con từ index bắt đầu đến kết thúc.",
    useWhen: ["Trích xuất một phạm vi phần tử từ một mảng."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Start index", description: "Index bắt đầu cắt (bao gồm cả index này).", details: [] },
      { name: "End index", description: "Index kết thúc cắt (không bao gồm index này).", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu danh sách con.", details: [] },
    ],
    examples: ["Cắt danh sách: cấu hình index bắt đầu và kết thúc."],
    commonMistakes: ["Đặt index bắt đầu lớn hơn index kết thúc."],
  },
  join_list: {
    title: "Nối danh sách Help",
    summary: "Nối tất cả phần tử danh sách thành một chuỗi văn bản duy nhất.",
    useWhen: ["Định dạng các phần tử danh sách cho văn bản đầu ra hoặc tệp."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Separator text", description: "Kí tự phân tách đặt giữa các phần tử.", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu chuỗi kết quả.", details: [] },
    ],
    examples: ["Nối danh sách: cấu hình danh sách và kí tự phân tách."],
    commonMistakes: ["Dùng trên danh sách chứa đối tượng mà không ánh xạ (map) trước."],
  },
  filter_list: {
    title: "Lọc danh sách Help",
    summary: "Lọc phần tử danh sách dựa trên các quy tắc trực quan.",
    useWhen: ["Lọc các phần tử của một mảng khớp với các điều kiện cụ thể."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu danh sách đã lọc.", details: [] },
      { name: "Combine operator", description: "Khớp điều kiện AND hoặc OR.", details: [] },
      { name: "Filter rules", description: "Danh sách các quy tắc logic.", details: [] },
    ],
    examples: ["Lọc danh sách: cấu hình danh sách nguồn và các quy tắc."],
    commonMistakes: ["Không tham chiếu 'item' trong các quy tắc logic."],
  },
  map_list_property: {
    title: "Ánh xạ thuộc tính danh sách Help",
    summary: "Trích xuất một thuộc tính từ danh sách đối tượng.",
    useWhen: ["Chuyển đổi một mảng đối tượng thành một mảng chứa thuộc tính của chúng."],
    fields: [
      { name: "Source list", description: "Tên danh sách nguồn.", details: [] },
      { name: "Property key to extract", description: "Khóa của thuộc tính cần trích xuất.", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu danh sách đã ánh xạ.", details: [] },
    ],
    examples: ["Ánh xạ thuộc tính danh sách: cấu hình khóa thuộc tính cần trích xuất."],
    commonMistakes: ["Dùng trên mảng không chứa đối tượng."],
  },
  sort_reverse_list: {
    title: "Sắp xếp / Đảo ngược danh sách Help",
    summary: "Sắp xếp phần tử danh sách hoặc đảo ngược thứ tự của chúng.",
    useWhen: ["Sắp xếp phần tử theo bảng chữ cái, theo số hoặc đảo ngược chúng."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Action", description: "Sắp xếp tăng dần, giảm dần hoặc đảo ngược.", details: [] },
      { name: "Sort key", description: "Khóa thuộc tính để sắp xếp các đối tượng (tùy chọn).", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu kết quả.", details: [] },
    ],
    examples: ["Sắp xếp / Đảo ngược danh sách: chọn hành động sắp xếp."],
    commonMistakes: ["Lỗi so sánh chuỗi và số lẫn lộn khi sắp xếp."],
  },
  execute_list_script: {
    title: "Thực thi Script danh sách Help",
    summary: "Chạy mã Javascript tùy chỉnh để xử lý danh sách.",
    useWhen: ["Thực hiện các chuyển đổi hoặc ánh xạ nâng cao bằng mã code."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "JavaScript Script", description: "Mã code trả về kết quả (danh sách được gắn vào biến 'list').", details: [] },
      { name: "Result output variable name", description: "Tên biến để lưu kết quả.", details: [] },
    ],
    examples: ["Thực thi Script danh sách: viết script return list.filter(...)."],
    commonMistakes: ["Quên trả về (return) một giá trị từ script."],
  },
  check_list_empty: {
    title: "Kiểm tra danh sách rỗng Help",
    summary: "Kiểm tra xem danh sách có rỗng hay không.",
    useWhen: ["Thêm phân nhánh logic dựa trên độ rỗng của mảng."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu kết quả boolean.", details: [] },
    ],
    examples: ["Kiểm tra danh sách rỗng: cấu hình danh sách nguồn."],
    commonMistakes: ["Kiểm tra biến danh sách không tồn tại."],
  },
  check_list_contains: {
    title: "Kiểm tra danh sách chứa phần tử Help",
    summary: "Kiểm tra xem danh sách có chứa một giá trị cụ thể hay không.",
    useWhen: ["Phân nhánh điều kiện nếu một phần tử nằm trong danh sách."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Value type to check", description: "Kiểu dữ liệu của giá trị tìm kiếm.", details: [] },
      { name: "Value to search for", description: "Giá trị cần tìm.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu kết quả boolean.", details: [] },
    ],
    examples: ["Kiểm tra danh sách chứa phần tử: cấu hình giá trị cần kiểm tra."],
    commonMistakes: ["Kiểu dữ liệu giá trị tìm kiếm không khớp."],
  },
  check_list_any_match: {
    title: "Kiểm tra danh sách khớp bất kỳ Help",
    summary: "Kiểm tra xem có bất kỳ phần tử danh sách nào khớp điều kiện.",
    useWhen: ["Xác minh xem có ít nhất một phần tử thỏa mãn các quy tắc."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu kết quả boolean.", details: [] },
      { name: "Combine operator", description: "Khớp điều kiện AND hoặc OR.", details: [] },
      { name: "Filter rules", description: "Danh sách các quy tắc logic.", details: [] },
    ],
    examples: ["Kiểm tra danh sách khớp bất kỳ: cấu hình quy tắc khớp."],
    commonMistakes: ["Không tham chiếu 'item' trong quy tắc so sánh."],
  },
  check_list_all_match: {
    title: "Kiểm tra danh sách khớp tất cả Help",
    summary: "Kiểm tra xem tất cả phần tử danh sách có khớp điều kiện.",
    useWhen: ["Xác minh xem mọi phần tử có thỏa mãn các quy tắc."],
    fields: [
      { name: "Source list variable name", description: "Tên danh sách nguồn.", details: [] },
      { name: "Result output variable name", description: "Tên biến lưu kết quả boolean.", details: [] },
      { name: "Combine operator", description: "Khớp điều kiện AND hoặc OR.", details: [] },
      { name: "Filter rules", description: "Danh sách các quy tắc logic.", details: [] },
    ],
    examples: ["Kiểm tra danh sách khớp tất cả: cấu hình quy tắc khớp."],
    commonMistakes: ["Không tham chiếu 'item' trong quy tắc so sánh."],
  },
  update_object_variable: {
    title: "Cập nhật biến đối tượng Help",
    summary: "Thao tác trên đối tượng JSON (merge, set key, delete key).",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      { name: "Variable name", description: "Tên biến đối tượng cần cập nhật.", details: [] },
      { name: "Operation", description: "Thao tác đối tượng (merge, deep_merge, set_key, delete_key).", details: [] },
      { name: "Value", description: "Giá trị JSON cần merge hoặc deep merge.", details: [] },
      { name: "Property key", description: "Đường dẫn key cần thao tác (hỗ trợ dot-path).", details: [] },
      { name: "Property value type", description: "Kiểu dữ liệu của key cần set.", details: [] },
      { name: "Property value", description: "Giá trị của key cần set.", details: [] },
    ],
    examples: ["Cập nhật biến đối tượng: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  transform_variable: {
    title: "Transform Variable Help",
    summary: "Tạo output mới từ output có sẵn.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Source output",
        description: "Output đầu vào.",
        details: ["Phải được tạo trước khi node này chạy."],
      },
      {
        name: "Target output",
        description: "Tên output mới.",
        details: ["Các node sau đọc giá trị qua tên này."],
      },
      {
        name: "Expression",
        description: "Biểu thức transform.",
        details: ["Giữ biểu thức đơn giản và dễ kiểm tra."],
      },
    ],
    examples: ["Transform Variable: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  assert_output: {
    title: "Assert Output Help",
    summary: "Yêu cầu output khớp giá trị mong đợi.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Output name",
        description: "Output cần kiểm tra.",
        details: ["Output phải tồn tại trước khi assert."],
      },
      {
        name: "Match",
        description: "Equals khớp chính xác; Contains chỉ cần chứa đoạn text.",
        details: ["Chọn Contains cho text dài hoặc thay đổi nhẹ."],
      },
      {
        name: "Expected value",
        description: "Giá trị mong đợi.",
        details: ["Kiểm tra cả khoảng trắng và chữ hoa/thường."],
      },
    ],
    examples: ["Assert Output: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  domain_allowlist: {
    title: "Domain Allowlist Help",
    summary: "Giới hạn workflow trong các domain được phép.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Allowed domains",
        description: "Danh sách domain, mỗi dòng một domain.",
        details: ["Dùng domain không kèm path, ví dụ example.com.", "Nếu workflow rời khỏi allowlist, run phải bị chặn theo semantics hiện có."],
      },
    ],
    examples: ["Domain Allowlist: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  get_current_url: {
    title: "Get Current URL Help",
    summary: "Lấy URL trang hiện tại và lưu vào system.current_url.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Output",
        description: "Dữ liệu URL được lưu vào system.current_url.",
        details: ["Không cần cấu hình thêm."],
      },
    ],
    examples: ["Get Current URL: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
  quarantined: {
    title: "Cách ly (Quarantined) Help",
    summary: "Nút bị cách ly do schema không hợp lệ hoặc không được hỗ trợ.",
    useWhen: ["Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."],
    fields: [
      {
        name: "Trạng thái",
        description: "Nút bị giữ lại để tham khảo nhưng không được bi dịch hoặc thực thi.",
        details: ["Sửa hoặc thay thế payload hành động trước khi chạy lại."],
      },
    ],
    examples: ["Cách ly (Quarantined): cấu hình field trong inspector, rồi nối các port cần thiết trên canvas."],
    commonMistakes: ["Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."],
  },
};
