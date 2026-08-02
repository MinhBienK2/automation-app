# Quy Trình Thiết Kế Lại UI Bằng Claude Design

Tài liệu này dành cho **người dùng**, không phải agent. Nó mô tả cách dùng
`claude.ai/design` + Claude Code để thiết kế lại giao diện app, và chứa sẵn
prompt để copy vào session mới.

## Bối Cảnh Đã Xác Minh

| Hạng mục | Tình trạng |
| --- | --- |
| Lệnh có sẵn | `/design-login` (đã cấp quyền), `/design-sync` |
| Project trên claude.ai/design | `Modernist` — id `27328bfb-722d-4b23-b0f5-6f657c22f301` |
| Vấn đề của project đó | Là template built-in chưa sửa: nền sáng `#f3f2f2`, accent đỏ `#ec3013`, font Archivo, bo góc `0px`, template landing/deck |
| Design thật của app | `DESIGN.md` — nền tối `#0b1016`, accent cyan `#32d3e6`, bo góc 8px, desktop ops dày đặc |
| Token thật | `src/styles/base.css` (`--bg`, `--accent`, `--space-*`) |
| Cầu nối daisyUI | `src/App.css` |
| Component | `src/components/ui/` (34 file), `src/components/layout/` |
| Trang | `src/features/*/pages/` |
| CSS thủ công | 12 file trong `src/styles/` — nơi design hay bị trôi khỏi token |
| Stack | React 19, Tailwind 4, daisyUI 5, shadcn (new-york), lucide-react, @xyflow/react |
| Storybook | **Không có** — ảnh hưởng tới cách `/design-sync` chạy |

## Nguyên Tắc Cốt Lõi

1. **Sửa bản nháp trước, sửa code sau.** Lặp trên HTML tĩnh mất vài giây; sửa
   code rồi build lại Electron mất hàng chục phút.
2. **Token trước, component sau.** Đổi giá trị trong `base.css` là cả app đổi
   theo. Đừng đi sửa từng trang.
3. **Một giai đoạn một session.** Đừng gộp cả 6 bước vào một cuộc trò chuyện.
4. **`finalize_plan` là chốt chặn.** Trước khi ghi lên claude.ai, hệ thống hiện
   bảng danh sách file. Đọc bảng đó, không đọc lời agent kể.

## Ba Chốt Kiểm Soát

- **Quyền** — không có `/design-login` thì agent không chạm được gì.
- **Ghi/xoá** — bắt buộc qua `finalize_plan`, bạn duyệt danh sách file.
- **Code repo** — permission thường như mọi thay đổi file khác.

## Câu Ghìm Agent

Chèn vào cuối bất kỳ prompt nào khi thấy agent đi quá đà:

- `Đừng ghi gì, chỉ báo cáo.`
- `Cho tôi xem danh sách file trước khi ghi.`
- `Chỉ làm <component>, không đụng chỗ khác.`
- `Giải thích tại sao chọn phương án đó.`
- `Dừng lại, tôi muốn xem trước.`

---

# Giai Đoạn 0 — Chuẩn Bị

Chạy một lần trong terminal:

```bash
claude plugin install frontend-design@claude-plugins-official
```

Plugin này cấp cho agent quan điểm thẩm mỹ. Không có nó thì kết quả vẫn chạy
được nhưng dễ ra giao diện template-hoá.

---

# Giai Đoạn 1 — Kiểm Kê (chỉ đọc)

**Mục tiêu:** biết chính xác hiện trạng xấu ở đâu, trước khi sửa bất cứ thứ gì.

**Session mới, prompt:**

```
Đây là app Electron desktop (React 19 + Tailwind 4 + daisyUI 5 + shadcn).
Tôi muốn thiết kế lại UI. Giai đoạn này CHỈ KIỂM KÊ, không sửa gì hết.

Đọc:
- DESIGN.md
- src/styles/base.css và src/App.css
- 12 file CSS trong src/styles/
- src/components/ui/ và src/components/layout/
- 3 trang chính: src/features/overview/pages/, src/features/workflows/pages/,
  src/features/schedules/pages/

Rồi dùng tool DesignSync (method list_files và get_file) đọc project
"Modernist" id 27328bfb-722d-4b23-b0f5-6f657c22f301 trên claude.ai/design.

Báo cáo cho tôi:
1. Design system trên claude.ai lệch với DESIGN.md ở những điểm nào.
2. Trong 12 file CSS, chỗ nào hard-code màu/khoảng cách thay vì dùng biến
   token của base.css. Liệt kê file:dòng.
3. Component nào trong src/components/ui/ đang tự vẽ style riêng thay vì
   kế thừa token.
4. Điểm yếu thẩm mỹ lớn nhất của UI hiện tại, xếp theo mức độ nghiêm trọng.

Không ghi file, không gọi finalize_plan, không sửa code.
```

**Kết thúc giai đoạn:** bạn có danh sách vấn đề cụ thể. Lưu lại report này.

---

# Giai Đoạn 2 — Chốt Bản Sắc

**Mục tiêu:** `DESIGN.md` hiện tại chỉ có 72 dòng **ràng buộc** ("dùng 4px/8px",
"đừng lồng card") mà **không có bản sắc** — không nói app này trông như thế nào,
khác gì Linear hay Datadog. Agent đọc nó chỉ biết cách không sai, không biết
cách đẹp. Giai đoạn này sửa điều đó.

**Session mới, prompt:**

```
Đọc DESIGN.md và src/styles/base.css.

Vấn đề: DESIGN.md chỉ liệt kê ràng buộc, không có bản sắc thị giác. Nó không
nói app này TRÔNG NHƯ THẾ NÀO và khác gì các dashboard khác.

App này là mission control cho automation trình duyệt nội bộ: chạy workflow
lặp lại, xem log, theo dõi lịch chạy, dựng workflow bằng graph. Người dùng là
kỹ thuật viên nội bộ, nhìn màn hình này nhiều giờ mỗi ngày. Tham chiếu đúng là
công cụ vận hành (Linear, Grafana, Datadog), KHÔNG phải landing page.

Đề xuất cho tôi 3 hướng thẩm mỹ khác nhau. Mỗi hướng gồm:
- Bảng màu 4-6 mã hex có tên vai trò
- Cặp font (display / body / mono) và lý do
- Ý tưởng bố cục, mô tả bằng 1 câu + wireframe ASCII
- MỘT "signature" — thứ khiến app này được nhớ

Yêu cầu: cả 3 hướng phải giữ được mật độ thông tin cao và đọc lâu không mỏi
mắt. Đừng đề xuất 3 biến thể của cùng một ý. Nói rõ hướng nào bạn khuyên và
tại sao.

Chưa viết code, chưa sửa DESIGN.md. Chỉ đề xuất.
```

Sau khi bạn chọn được hướng, prompt tiếp:

```
Tôi chọn hướng <số>. Viết lại DESIGN.md theo hướng đó.

Cấu trúc mới phải có, theo thứ tự:
1. Bản sắc — app này trông như thế nào, 1 đoạn văn
2. Signature — thứ được nhớ
3. Token màu, có ghi vai trò từng màu
4. Typography — thang cỡ chữ cụ thể
5. Hình khối, mật độ, khoảng cách
6. Bố cục shell
7. Tương tác và trạng thái
8. Điều cấm

Giữ nguyên các ràng buộc kỹ thuật đang đúng trong bản cũ (mật độ cao,
không dùng màu đơn lẻ để báo trạng thái, không nhập nhèm hero marketing).

Chỉ sửa DESIGN.md. Chưa đụng code.
```

**Kết thúc giai đoạn:** `DESIGN.md` có bản sắc. Đây là nguồn chân lý cho mọi
bước sau.

---

# Giai Đoạn 3 — Dựng Bản Nháp Và Đẩy Lên Claude Design

**Mục tiêu:** có bản nháp HTML tĩnh trên `claude.ai/design` để nhìn và chê,
không phải build lại Electron mỗi lần.

**Session mới, prompt:**

```
Đọc DESIGN.md (đã viết lại) và src/styles/base.css.

Tôi muốn đẩy design system của app lên claude.ai/design thành project MỚI
(đừng ghi đè "Modernist" — đó là template built-in không liên quan).

Bước 1: thử chạy /design-sync trỏ vào src/components/ui/. Repo này KHÔNG có
Storybook, nên nếu bộ chuyển đổi không nhận thì báo tôi ngay, đừng cố ép.

Bước 2 (nếu bước 1 không chạy): dựng thủ công một bundle HTML tĩnh trong
thư mục scratch/design-bundle/ gồm:
- styles.css — toàn bộ token lấy từ src/styles/base.css, không hard-code hex
- foundations/color.html, foundations/type.html, foundations/layout.html
- components/buttons.html, components/table.html, components/dialog.html,
  components/forms.html, components/cards.html, components/status.html
- templates/workflow-detail.html — dựng lại trang workflow detail thật
- readme.md — mô tả hệ thống

Rồi dùng tool DesignSync: create_project tên "Mission Control", finalize_plan,
write_files.

TRƯỚC KHI gọi finalize_plan, in ra cho tôi danh sách đầy đủ file sẽ ghi và
đợi tôi duyệt.
```

**Kết thúc giai đoạn:** mở `claude.ai/design`, thấy project "Mission Control"
với các trang preview.

---

# Giai Đoạn 4 — Vòng Lặp Phê Bình

**Mục tiêu:** làm cho đẹp. Đây là chỗ tốn nhiều vòng nhất, và cũng là chỗ rẻ
nhất để lặp.

**Cùng session với giai đoạn 3, hoặc session mới.** Mỗi lần chê một thứ:

```
Mở scratch/design-bundle/components/table.html.

Vấn đề: <mô tả cụ thể — ví dụ "hàng quá thưa, đọc 50 dòng phải cuộn nhiều",
"viền quá đậm làm rối mắt", "trạng thái running không nổi bật">

Sửa lại. Chỉ sửa file này, không đụng file khác. Sau khi sửa xong đẩy lên
project "Mission Control" và cho tôi biết đường dẫn để xem.
```

Mẹo cho vòng lặp này:

- **Chê cụ thể, đừng chê chung.** "Xấu" không hành động được. "Khoảng cách
  giữa các hàng quá lớn, mất mật độ" thì hành động được.
- **Một lần một thứ.** Sửa 5 thứ cùng lúc thì không biết cái nào làm hỏng.
- Muốn đối chiếu: `Cho tôi 2 phương án cho <thành phần>, dựng cả hai cạnh nhau
  trong cùng một file để tôi so sánh.`
- Muốn agent tự phê bình trước: `Tự phê bình bản này trước khi hỏi tôi. Nêu 3
  điểm yếu và tự sửa.`

**Kết thúc giai đoạn:** bạn nhìn bản nháp và thấy hài lòng. Chỉ khi đó mới
sang giai đoạn 5.

---

# Giai Đoạn 5 — Áp Vào Code

**Mục tiêu:** đưa thiết kế đã duyệt vào app thật. Làm theo đúng thứ tự dưới,
đừng đảo.

**Session mới, prompt (bước 5a — token):**

```
Repo này có quy ước riêng: đọc AGENTS.md và docs/README.md trước, và chạy
node scripts/agent/agent-router.mjs --query "design tokens styling" để biết
tài liệu và test cần chạy.

Bản nháp đã duyệt nằm ở scratch/design-bundle/. DESIGN.md đã cập nhật.

Bước này CHỈ đổi giá trị token trong src/styles/base.css cho khớp bản nháp.
Không đổi tên biến. Không sửa file CSS khác. Không sửa component.

Sau khi sửa, kiểm tra src/App.css xem daisyUI theme mapping còn đúng không.

Rồi chạy: npm run test, npm run lint, npm run build.
Báo cáo kết quả thật, kể cả khi fail.
```

**Bước 5b — dọn CSS trôi:**

```
Dùng report từ giai đoạn 1 (danh sách chỗ hard-code trong src/styles/).

Thay các giá trị hard-code đó bằng biến token tương ứng của base.css.
Làm từng file một, theo thứ tự: mission-control.css, layout.css,
workflows.css, rồi các file còn lại.

Sau mỗi file, chạy npm run test và cho tôi biết trước khi sang file tiếp.
Nếu chỗ nào không map được sang token có sẵn, dừng lại hỏi tôi chứ đừng
tự đặt biến mới.
```

**Bước 5c — component:**

```
So sánh src/components/ui/ với bản nháp trong scratch/design-bundle/components/.

Liệt kê component nào cần sửa và sửa cái gì. Đợi tôi duyệt danh sách rồi
mới sửa.

Lưu ý repo dùng shadcn (new-york) + daisyUI: đừng thay thế component, chỉ
điều chỉnh cho khớp bản nháp. Có test đi kèm trong src/components/ui/ —
giữ cho chúng xanh.
```

---

# Giai Đoạn 6 — Nghiệm Thu

**Session mới, prompt:**

```
Chạy đầy đủ: npm run test, npm run lint, npm run build.

Rồi khởi động app (npm run electron:dev) và chụp màn hình 4 trang:
overview, workflow list, workflow detail, schedules.

Đối chiếu ảnh chụp với scratch/design-bundle/ và DESIGN.md. Chỗ nào code
thật lệch khỏi bản nháp thì liệt kê ra.

Cuối cùng, cập nhật docs/ theo Update Rule trong docs/README.md nếu có
thay đổi cần ghi nhận.
```

---

# Bảng Tra Nhanh

| Bạn muốn | Gõ gì |
| --- | --- |
| Xem có project design nào | `Liệt kê project trên claude.ai/design của tôi.` |
| Xem project chứa gì | `Liệt kê file trong project <tên>. Đừng ghi gì.` |
| Đối chiếu design vs code | `So sánh project <tên> với DESIGN.md, liệt kê chỗ lệch.` |
| Đổi một màu | `Đổi --accent trong base.css sang <hex>. Chỉ file đó.` |
| Quay lại bản cũ | `git diff` rồi `git checkout -- <file>` |
| Dừng agent giữa chừng | Nhấn `Esc` |

## Sai Lầm Cần Tránh

- **Dùng template built-in làm design system cho app.** Đây là lỗi đã xảy ra
  với "Modernist" — kết quả là mọi UI sinh ra đều kéo app ra xa `DESIGN.md`.
- **Nhảy thẳng vào sửa code.** Mỗi vòng lặp tốn hàng chục phút thay vì vài giây.
- **Gộp nhiều giai đoạn vào một session.** Context loãng, agent bắt đầu tự ý
  sửa lan man.
- **Chê chung chung.** "Làm đẹp hơn đi" không cho agent thông tin nào để hành động.
- **Để bản nháp và code trôi khỏi nhau.** Sau giai đoạn 5, `styles.css` trên
  claude.ai và `src/styles/base.css` phải cùng bộ giá trị.
