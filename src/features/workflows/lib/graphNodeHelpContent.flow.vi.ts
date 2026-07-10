import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const flowNodesVi: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  start: {
    title: "Trợ giúp Bắt đầu (Start)",
    summary: "Điểm khởi đầu của workflow graph.",
    useWhen: ["Luôn bắt buộc phải có để bắt đầu workflow."],
    fields: [
      {
        name: "Ports",
        description: "Node này được nối với node đầu tiên cần thực thi trong canvas.",
        details: [
          "Cổng Out truyền luồng chạy sang node tiếp theo.",
          "Chỉ có duy nhất một cổng Out và không có cổng In."
        ],
      },
    ],
    examples: ["Nối cổng Out của Start vào node Click hoặc Navigate đầu tiên."],
    commonMistakes: ["Xóa hoặc không nối cổng Out của Start khiến workflow không thể bắt đầu chạy."],
  },
  end_success: {
    title: "Trợ giúp Kết thúc Thành công (Success End)",
    summary: "Dừng và kết thúc workflow với trạng thái thành công.",
    useWhen: ["Dùng làm điểm kết thúc cho nhánh logic thành công."],
    fields: [
      {
        name: "Ports",
        description: "Nhận luồng chạy kết thúc.",
        details: [
          "Cổng In nhận luồng từ các node trước.",
          "Không có cổng Out."
        ],
      },
    ],
    examples: ["Nối cổng done của loop hoặc các thao tác cuối cùng vào Success End."],
    commonMistakes: ["Quên nối nhánh cuối cùng vào Success End làm luồng chạy bị ngắt quãng hoặc không được ghi nhận kết thúc thành công."],
  },
  end_failure: {
    title: "Trợ giúp Kết thúc Thất bại (End Failure)",
    summary: "Dừng và kết thúc workflow với trạng thái thất bại và lý do rõ ràng.",
    useWhen: [
      "Dùng khi phát hiện lỗi nghiệp vụ không thể tiếp tục (ví dụ: tài khoản bị khóa).",
      "Dùng ở nhánh xử lý lỗi sau khi đã thử lại nhiều lần thất bại."
    ],
    fields: [
      {
        name: "Failure reason",
        description: "Thông báo lỗi hiển thị khi workflow kết thúc tại đây.",
        details: [
          "Nên viết ngắn gọn nhưng rõ ràng về nguyên nhân thất bại.",
          "Lý do này sẽ được ghi nhận vào lịch sử chạy (run history) để tiện kiểm tra."
        ],
      },
    ],
    examples: ["Failure reason: 'Không thể đăng nhập do sai mật khẩu sau khi thử lại'"],
    commonMistakes: ["Để lý do quá chung chung (ví dụ: 'Lỗi') khiến việc kiểm tra log sau này gặp khó khăn."],
  },
  action: {
    title: "Trợ giúp Action Node",
    summary: "Chạy một hành động tự động hóa trình duyệt hoặc xử lý dữ liệu.",
    useWhen: ["Dùng để thực hiện các thao tác Click, Gõ chữ, Cuộn trang, Trích xuất dữ liệu, v.v."],
    fields: [
      {
        name: "Action type",
        description: "Loại hành động cụ thể cần thực hiện.",
        details: [
          "Sau khi chọn Action type, giao diện cấu hình và trợ giúp chi tiết cho loại hành động đó sẽ xuất hiện.",
          "Nếu thay đổi Action type, cấu hình cũ của node này sẽ bị xóa và reset về mặc định."
        ],
      },
    ],
    examples: ["Action type: Click, XPath: //button[@id='submit']"],
    commonMistakes: ["Kéo node Action ra canvas nhưng quên không chọn Action type trước khi chạy."],
  },
  call_subflow: {
    title: "Trợ giúp Gọi Subflow (Call Subflow)",
    summary: "Chạy một luồng con (subflow) trong cùng một project, chia sẻ chung trình duyệt và lưu trữ.",
    useWhen: ["Dùng để tái sử dụng các đoạn graph lặp đi lặp lại như Đăng nhập, Xác minh tài khoản, Điền thông tin cơ bản."],
    fields: [
      {
        name: "Subflow id",
        description: "Subflow cần gọi.",
        details: [
          "Phải là subflow thuộc cùng một project.",
          "Không thể gọi subflow đã bị xóa hoặc thuộc project khác."
        ],
      },
      {
        name: "Input mapping",
        description: "Các tham số (input) truyền vào subflow dưới dạng key=value.",
        details: [
          "Mỗi dòng cấu hình một tham số truyền vào.",
          "Hỗ trợ truyền giá trị động thông qua template, ví dụ: username={{account.username}}."
        ],
      },
      {
        name: "Output prefix",
        description: "Tiền tố tùy chọn được thêm trước các biến đầu ra do subflow tạo ra.",
        details: [
          "Dùng khi bạn gọi một subflow nhiều lần và muốn phân biệt dữ liệu đầu ra giữa các lần gọi (ví dụ: login_1_username, login_2_username)."
        ],
      },
    ],
    examples: ["Subflow id: subflow-login", "Input mapping: email={{account.email}}\\npassword={{account.password}}"],
    commonMistakes: [
      "Tạo vòng lặp đệ quy (Subflow A gọi Subflow B, Subflow B lại gọi Subflow A) gây treo hệ thống.",
      "Không truyền đủ các tham số đầu vào bắt buộc mà subflow con yêu cầu."
    ],
  },
  merge: {
    title: "Trợ giúp Hợp nhất (Merge)",
    summary: "Gom nhiều nhánh rẽ quay về một luồng chạy chung ngay lập tức mà không cần chờ đợi nhau.",
    useWhen: ["Dùng để hội tụ các nhánh rẽ (ví dụ: True và False của If) trở lại luồng chính."],
    fields: [
      {
        name: "Ports",
        description: "Cấu hình bằng cách nối các cổng trên canvas.",
        details: [
          "Cổng In nhận nhiều kết nối từ các nhánh rẽ khác nhau.",
          "Cổng Out truyền luồng chạy chung đi tiếp."
        ],
      },
    ],
    examples: ["Hợp nhất nhánh đăng nhập thành công và nhánh đã có session về chung một luồng cào dữ liệu."],
    commonMistakes: ["Nối nhầm luồng chạy vòng lặp qua Merge, gây ra vòng lặp vô hạn không mong muốn."],
  },
  router: {
    title: "Trợ giúp Phân luồng Ưu tiên (Router)",
    summary: "Kiểm tra danh sách các điều kiện từ trên xuống dưới và kích hoạt cổng ra khớp đầu tiên.",
    useWhen: ["Dùng khi cần rẽ nhiều nhánh dựa trên trạng thái trang hoặc dữ liệu (tương tự như chuỗi lệnh if-else if-else)."],
    fields: [
      {
        name: "Condition",
        description: "Các điều kiện được định nghĩa theo thứ tự ưu tiên.",
        details: [
          "Mỗi điều kiện khớp sẽ kích hoạt một cổng ra tương ứng (case_1, case_2, ...).",
          "Hỗ trợ kiểm tra biến, sự xuất hiện của chữ/element trên trang, hoặc kiểm tra URL."
        ],
      },
      {
        name: "Done port",
        description: "Cổng chạy sau khi nhánh được chọn hoàn tất.",
        details: [
          "Cổng done là tùy chọn; nếu bỏ trống, luồng sẽ kết thúc thành công sau khi chạy xong nhánh con."
        ],
      },
    ],
    examples: ["Router kiểm tra: Dòng 1: Nếu thấy nút Login (nối nhánh login); Dòng 2: Nếu thấy nút Verification (nối nhánh OTP); Default: Nối luồng chính."],
    commonMistakes: ["Đặt một điều kiện quá rộng ở dòng trên cùng khiến các điều kiện cụ thể hơn ở phía dưới không bao giờ được đánh giá."],
  },
  random_choice: {
    title: "Trợ giúp Chọn Ngẫu nhiên (Random Choice)",
    summary: "Chọn ngẫu nhiên một cổng ra để chạy dựa trên trọng số (probability/weight) cấu hình.",
    useWhen: [
      "Dùng khi muốn hành vi chạy tự nhiên, tránh bị phát hiện bot (ví dụ: 70% click link A, 30% click link B).",
      "Dùng cho thử nghiệm A/B testing các luồng chạy."
    ],
    fields: [
      {
        name: "Choices",
        description: "Danh sách các cổng ra kèm nhãn và trọng số tương ứng.",
        details: [
          "Trọng số càng cao, tỷ lệ nhánh đó được chọn càng lớn.",
          "Tổng trọng số không nhất thiết phải bằng 100."
        ],
      },
      {
        name: "Output name",
        description: "Tên biến lưu lại nhãn của nhánh ngẫu nhiên đã được chọn.",
        details: [
          "Dùng để ghi log hoặc phân tích logic ở các node sau."
        ],
      },
    ],
    examples: ["Choice 1: label='Đọc báo', weight=60; Choice 2: label='Xem video', weight=40 để phân bổ luồng chạy."],
    commonMistakes: ["Đặt trọng số bằng 0 cho nhánh cần chạy, hoặc không nối cổng ra cho choice được chọn làm luồng bị đứng."],
  },
  if: {
    title: "Trợ giúp Rẽ nhánh Điều kiện (If)",
    summary: "Rẽ hướng workflow sang nhánh True (Đúng) hoặc False (Sai) dựa trên một điều kiện kiểm tra.",
    useWhen: ["Dùng khi cần kiểm tra một điều kiện đơn giản (ví dụ: Đã đăng nhập chưa?, Có thấy thông báo lỗi không?)."],
    fields: [
      {
        name: "Condition",
        description: "Điều kiện kiểm tra trạng thái trang hoặc biến.",
        details: [
          "Kiểm tra biến (boolean), sự xuất hiện của chữ, element XPath, hoặc URL chứa đoạn text."
        ],
      },
      {
        name: "True port",
        description: "Nhánh chạy khi điều kiện đúng.",
        details: ["Nếu bỏ trống, hệ thống sẽ bỏ qua và đi tiếp đến cổng done."]
      },
      {
        name: "False port",
        description: "Nhánh chạy khi điều kiện sai.",
        details: ["Nếu bỏ trống, hệ thống sẽ bỏ qua và đi tiếp đến cổng done."]
      },
      {
        name: "Done port",
        description: "Cổng chung chạy sau khi nhánh True hoặc False hoàn thành.",
        details: ["Dùng để nối hai nhánh quay trở lại luồng chính."]
      }
    ],
    examples: ["Condition: URL contains '/dashboard', True nối với cào dữ liệu, False nối với đăng nhập, Done nối với xuất báo cáo."],
    commonMistakes: ["Nối thẳng các bước tiếp theo vào cổng True/False thay vì nối vào Done, khiến nhánh còn lại không thể quay về luồng chính."],
  },
  switch: {
    title: "Trợ giúp Phân nhánh Giá trị (Switch)",
    summary: "Rẽ nhánh dựa trên giá trị chính xác của một biểu thức đầu vào.",
    useWhen: ["Dùng khi một biến có thể nhận nhiều giá trị cố định khác nhau và mỗi giá trị cần một hành động riêng."],
    fields: [
      {
        name: "Switch expression",
        description: "Biểu thức hoặc biến cần kiểm tra.",
        details: ["Thường là biến động dạng {{role}} hoặc {{user.status}}."]
      },
      {
        name: "Switch cases",
        description: "Danh sách các giá trị tương ứng tạo ra các cổng ra.",
        details: [
          "Mỗi giá trị tạo ra một cổng ra (ví dụ: 'admin', 'editor', 'viewer').",
          "Cổng Default chạy khi biểu thức không khớp với bất kỳ case nào."
        ]
      }
    ],
    examples: ["Expression: {{user_role}}, Cases: 'admin' (nối chức năng admin), 'guest' (nối chức năng guest), Default (nối báo lỗi)."],
    commonMistakes: ["Quên nối cổng Default, khiến workflow kết thúc lửng lơ khi giá trị thực tế không nằm trong danh sách cases."],
  },
  repeat_times: {
    title: "Trợ giúp Lặp số lần (Repeat Times)",
    summary: "Lặp lại một đoạn hành động trong cổng loop với số lần cố định.",
    useWhen: ["Dùng khi muốn lặp lại thao tác nhiều lần (ví dụ: click nút 'Xem thêm' 5 lần, tải lại trang 3 lần)."],
    fields: [
      {
        name: "Times",
        description: "Số lần lặp lại mong muốn.",
        details: [
          "Phải là một số nguyên dương lớn hơn 0.",
          "Hỗ trợ truyền giá trị động qua biến, ví dụ: {{loop_count}}."
        ]
      }
    ],
    examples: ["Times: 5 để chạy nhánh loop 5 lần, sau đó đi tiếp qua cổng done."],
    commonMistakes: ["Đặt số lần lặp quá lớn mà không có Break Loop thích hợp, dẫn đến treo hoặc bị chặn bởi rate limit."],
  },
  repeat_for_each: {
    title: "Trợ giúp Lặp danh sách (Repeat For Each)",
    summary: "Lặp lại đoạn hành động cho từng phần tử trong một danh sách (mảng).",
    useWhen: ["Dùng khi có một danh sách dữ liệu cần xử lý từng cái một (ví dụ: duyệt qua danh sách link để click từng cái)."],
    fields: [
      {
        name: "Item name",
        description: "Tên biến đại diện cho phần tử hiện tại của vòng lặp.",
        details: ["Các node bên trong cổng loop có thể gọi biến này bằng cú pháp {{item_name}}."]
      },
      {
        name: "Items",
        description: "Danh sách các phần tử cần duyệt qua.",
        details: [
          "Có thể là biến danh sách {{urls}} hoặc nhập thủ công các dòng text (mỗi hàng một dòng).",
          "Vòng lặp sẽ tự động bỏ qua các dòng trống."
        ]
      }
    ],
    examples: ["Item name: post_url, Items: {{posts}} (hoặc nhập danh sách url thủ công). Trong loop gọi {{post_url}}."],
    commonMistakes: ["Truyền biến không phải kiểu danh sách/mảng vào Items (ví dụ truyền chuỗi text), làm vòng lặp bị lỗi."],
  },
  repeat_until: {
    title: "Trợ giúp Lặp tới khi (Repeat Until)",
    summary: "Lặp lại đoạn hành động trong cổng loop cho đến khi điều kiện kiểm tra đúng hoặc chạm giới hạn.",
    useWhen: ["Dùng khi muốn lặp lại thao tác nhưng không biết trước số lần (ví dụ: click nút 'Next page' cho đến khi không còn nút đó nữa)."],
    fields: [
      {
        name: "Condition",
        description: "Điều kiện dừng vòng lặp.",
        details: ["Vòng lặp sẽ dừng ngay khi điều kiện này được đánh giá là True (Đúng)."]
      },
      {
        name: "Loop max attempts",
        description: "Giới hạn số lần lặp tối đa để tránh lặp vô hạn.",
        details: ["Bắt buộc phải lớn hơn 0. Giúp bảo vệ hệ thống nếu điều kiện dừng không bao giờ đạt được."]
      },
      {
        name: "Loop timeout ms",
        description: "Thời gian chạy tối đa của vòng lặp.",
        details: ["Nếu vượt quá thời gian này, vòng lặp sẽ dừng và chuyển sang nhánh timeout."]
      }
    ],
    examples: ["Condition: Element visible: //div[@id='success'], Max attempts: 20 để chờ tác vụ xử lý ngầm hoàn tất."],
    commonMistakes: ["Không cập nhật trạng thái trang trong loop khiến điều kiện lặp luôn sai, dẫn tới chạy hết số lần thử tối đa."],
  },
  while: {
    title: "Trợ giúp Lặp khi (While)",
    summary: "Lặp lại đoạn hành động trong cổng loop khi điều kiện kiểm tra vẫn còn đúng.",
    useWhen: ["Dùng để lặp lại một hành động dựa trên duy trì trạng thái (ví dụ: tiếp tục lặp khi popup thông báo vẫn đang hiển thị)."],
    fields: [
      {
        name: "Condition",
        description: "Điều kiện duy trì vòng lặp.",
        details: ["Vòng lặp tiếp tục chạy nếu điều kiện là True và sẽ dừng ngay khi điều kiện chuyển sang False."]
      },
      {
        name: "Loop max attempts",
        description: "Giới hạn số lần lặp tối đa để phòng ngừa lặp vô hạn.",
        details: ["Bắt buộc phải lớn hơn 0 để tự động ngắt khi logic bị lỗi."]
      },
      {
        name: "Loop timeout ms",
        description: "Thời gian chạy tối đa của vòng lặp tính bằng mili-giây.",
        details: []
      }
    ],
    examples: ["Condition: Text visible: 'Loading...', Max attempts: 10 để tiếp tục lặp nếu trang đang hiển thị chữ Loading..."],
    commonMistakes: ["Cấu hình điều kiện luôn đúng và quên cấu hình Max attempts thích hợp, dẫn đến trình duyệt bị quá tải."],
  },
  retry: {
    title: "Trợ giúp Thử lại (Retry)",
    summary: "Thử chạy lại nhánh Try nếu bất kỳ hành động nào trong nhánh đó bị lỗi.",
    useWhen: ["Dùng để xử lý các hành động có tính không ổn định, dễ lỗi do mạng hoặc trang load chậm (ví dụ: click nút gửi form, giải CAPTCHA)."],
    fields: [
      {
        name: "Max attempts",
        description: "Số lần thử lại tối đa (bao gồm cả lần chạy đầu tiên).",
        details: ["Phải lớn hơn 1."]
      },
      {
        name: "Delay ms",
        description: "Thời gian nghỉ giữa các lần thử lại.",
        details: ["Nên cấu hình một khoảng trễ nhỏ (ví dụ 1000 - 3000ms) để chờ hệ thống ổn định trước khi thử lại."]
      }
    ],
    examples: ["Max attempts: 3, Delay ms: 2000. Nếu click bị lỗi, nó sẽ đợi 2 giây rồi click lại, thử tối đa 3 lần."],
    commonMistakes: ["Dùng Retry bọc ngoài các hành động làm thay đổi dữ liệu vĩnh viễn (như thanh toán) gây phát sinh giao dịch lặp."],
  },
  try_catch: {
    title: "Trợ giúp Bắt lỗi (Try Catch)",
    summary: "Ngăn chặn lỗi trong nhánh try làm hỏng workflow, cho phép chạy nhánh error để xử lý sự cố.",
    useWhen: ["Dùng để bọc các khối lệnh quan trọng, khi lỗi xảy ra cần chụp ảnh màn hình, gửi cảnh báo hoặc reset trạng thái để chạy tiếp."],
    fields: [
      {
        name: "Ports",
        description: "Cấu hình bằng cách kết nối cổng trên canvas.",
        details: [
          "Cổng try: Nhánh thực thi chính.",
          "Cổng error: Nhánh chạy khi có lỗi trong cổng try.",
          "Cổng done: Nhánh chung chạy sau khi try thành công hoặc error chạy xong."
        ]
      }
    ],
    examples: ["Try nối với cào dữ liệu, Error nối với chụp màn hình lỗi và gửi log, Done nối với tắt trình duyệt."],
    commonMistakes: ["Để trống cổng error làm lỗi bị nuốt âm thầm, khiến workflow đi tiếp qua done như không có lỗi gì xảy ra."],
  },
  fallback: {
    title: "Trợ giúp Dự phòng (Fallback)",
    summary: "Thử chạy nhánh primary trước. Nếu nhánh primary bị lỗi, tự động chuyển sang chạy nhánh fallback dự phòng.",
    useWhen: ["Dùng khi giao diện trang web có 2 dạng hiển thị song song hoặc 2 cách bấm nút khác nhau (ví dụ: nút Click truyền thống hoặc gọi qua Javascript)."],
    fields: [
      {
        name: "Ports",
        description: "Nối các cổng hành động.",
        details: [
          "Cổng primary: Thử chạy nhánh này trước.",
          "Cổng fallback: Chỉ chạy nhánh này khi nhánh primary bị lỗi.",
          "Cổng done: Luồng chạy tiếp tục sau khi một trong hai nhánh hoàn thành."
        ]
      }
    ],
    examples: ["Primary nối click locator mới, Fallback nối click locator cũ của trang web."],
    commonMistakes: ["Không nối cổng fallback hoặc nối cả hai cổng trùng nhau làm mất tác dụng dự phòng."],
  },
  break_loop: {
    title: "Trợ giúp Thoát lặp (Break Loop)",
    summary: "Thoát ngay lập tức khỏi vòng lặp (Repeat, While) gần nhất chứa nó.",
    useWhen: ["Dùng bên trong vòng lặp khi phát hiện điều kiện dừng đặc biệt (ví dụ: tìm thấy từ khóa cần cào trong bảng thì dừng luôn vòng lặp)."],
    fields: [
      {
        name: "Ports",
        description: "Nhận luồng và ngắt lặp.",
        details: [
          "Chỉ có cổng In nhận luồng chạy.",
          "Khi được kích hoạt, luồng chạy nhảy thẳng tới cổng done của vòng lặp."
        ]
      }
    ],
    examples: ["Đặt Break Loop trong nhánh True của If kiểm tra: 'Nếu sản phẩm đã hết hàng' trong vòng lặp duyệt giỏ hàng."],
    commonMistakes: ["Đặt Break Loop bên ngoài mọi vòng lặp (vòng lặp cha). Cấu hình này sẽ bị validation chặn lại."],
  },
  continue_loop: {
    title: "Trợ giúp Bỏ qua lượt lặp (Continue Loop)",
    summary: "Bỏ qua phần còn lại của lượt lặp hiện tại và chuyển ngay sang lượt lặp tiếp theo.",
    useWhen: ["Dùng khi muốn bỏ qua xử lý cho một phần tử không hợp lệ trong danh sách (ví dụ: nếu email rỗng thì bỏ qua không gửi tin nhắn)."],
    fields: [
      {
        name: "Ports",
        description: "Nhận luồng và bỏ qua lượt.",
        details: [
          "Chỉ có cổng In nhận luồng chạy.",
          "Khi kích hoạt, luồng chạy bỏ qua các bước phía sau và nhảy sang phần tử tiếp theo của vòng lặp."
        ]
      }
    ],
    examples: ["Đặt Continue Loop trong khối If kiểm tra: 'Nếu giá sản phẩm = 0' để bỏ qua không cào thông tin chi tiết."],
    commonMistakes: ["Đặt Continue Loop bên ngoài mọi vòng lặp (vòng lặp cha). Cấu hình này sẽ bị validation chặn lại."],
  },
  stop_workflow: {
    title: "Trợ giúp Dừng Workflow (Stop Workflow)",
    summary: "Dừng workflow ngay lập tức với trạng thái thành công hoặc thất bại chỉ định.",
    useWhen: ["Dùng khi phát hiện điều kiện đặc biệt cần kết thúc sớm workflow tại một nhánh con cụ thể."],
    fields: [
      {
        name: "Status",
        description: "Trạng thái kết thúc mong muốn (Success hoặc Failure).",
        details: []
      },
      {
        name: "Reason",
        description: "Lý do dừng workflow.",
        details: ["Lý do này sẽ được ghi nhận vào lịch sử chạy để phục vụ công tác tra cứu log."]
      }
    ],
    examples: ["Status: Success, Reason: 'Đã cào đủ số lượng sản phẩm yêu cầu nên dừng sớm.'"],
    commonMistakes: ["Chọn Status là Success nhưng ghi nội dung Reason mô tả lỗi, gây mâu thuẫn trạng thái chạy."],
  },
};
