# Y tuong san pham: Workflow Browser Automation Manager

---

## 1. Dinh nghia san pham

**Workflow Browser Automation Manager** la mot app desktop giup nguoi dung tao va chay cac workflow tu dong thao tac tren website.

Trong ban MVP, san pham tap trung vao viec mo trinh duyet doc lap va thuc hien cac hanh dong web co ban theo thu tu step:

```text
Open URL
+ Sleep
+ Type Text
+ Click
+ Scroll
+ Test Step / Run Workflow
```

Hieu don gian:

> Nguoi dung tao mot workflow gom nhieu step action, dien truc tiep URL/XPath/text/thoi gian cho tung step, roi bam Test hoac Run de app tu mo Chromium va chay workflow do.

Ban dau khong tap trung vao profile, bien moi truong, browser session hay lay du lieu dau ra. Cac phan do se them sau khi loi workflow runner da on dinh.

---

## 2. Tam nhin san pham

Muc tieu dai han la tro thanh mot cong cu desktop de tao, quan ly va chay browser automation lap lai ma khong can viet code Playwright truc tiep.

San pham co the mo rong de ho tro:

- Quan ly nhieu workflow.
- Tu dong login username/password co ban.
- Dien form.
- Click cac nut tren website.
- Scroll trang.
- Cho mot khoang thoi gian bang Sleep.
- Chay workflow voi browser that dang hien thi.
- Them profile, variables, run history, import/export, scheduler va cac tinh nang debug sau.

Tuy nhien, ban dau chi can chung minh duoc mot dieu:

> Workflow phai tu mo browser doc lap va chay dung cac thao tac web co ban theo tung step.

---

## 3. Nguoi dung muc tieu ban dau

MVP phu hop voi nguoi dung ca nhan hoac team nho can tu dong hoa thao tac web lap lai.

Vi du:

- Nguoi thuong xuyen vao website, login va thuc hien cung mot chuoi thao tac.
- Nguoi can dien form tren website.
- Nguoi can click cac nut, chuyen trang, scroll va cho website phan hoi.
- Nguoi khong muon viet code Playwright.

O MVP, nguoi dung can biet cach lay XPath co ban cua element tren website va nhap vao step action.

Loai XPath uu tien:

```text
//*[@id="login-button"]
//*[@name="email"]
//*[@type="password"]
//button[contains(text(), "Login")]
//input[@placeholder="Email"]
```

Khong khuyen khich XPath tuyet doi nhu:

```text
/html/body/div[2]/div[1]/form/input[1]
```

vi de gay khi website thay doi layout.

---

## 4. Nguyen tac thiet ke MVP

MVP di theo nguyen tac:

```text
Don gian
+ Chay that duoc
+ Tu dong hoan toan
+ De hieu
+ De mo rong
```

Khong uu tien dashboard, canvas keo-tha, recorder, variables, profile hay run history truoc khi runner on dinh.

Thu quan trong nhat cua MVP la:

> Nguoi dung tao workflow, bam Test/Run, app tu mo Chromium doc lap va chay workflow tu dau den trang thai cuoi.

---

## 5. Pham vi MVP

MVP gom 4 phan chinh:

```text
1. Workflow List
2. Workflow Builder
3. Test Step
4. Run Workflow
```

MVP co luu du lieu local bang SQLite va co migration.

MVP chua co:

- Profile.
- Custom variables.
- Browser session rieng.
- Cookie/localStorage persistence.
- Run History.
- Output data.
- Screenshot action.
- Recorder.
- Element picker.
- Scheduler.
- Multi-run.
- Headless mode.

---

## 6. Workflow

Trong MVP, **Workflow** la mot kich ban automation hoan chinh.

Moi workflow gom:

- Ten workflow.
- Danh sach step action.
- Thoi gian tao.
- Thoi gian cap nhat.

Vi du:

```text
Workflow: Login example.com

1. Open URL
   URL: https://example.com/login

2. Sleep
   Seconds: 3

3. Type Text
   XPath: //*[@name="email"]
   Text: user@example.com

4. Type Text
   XPath: //*[@name="password"]
   Text: 123456

5. Click
   XPath: //*[@type="submit"]

6. Sleep
   Seconds: 5

7. Scroll
   Direction: down
   Pixels: 500
```

Tat ca du lieu can chay duoc dien truc tiep trong step. MVP khong dung cu phap `{{variable_name}}`.

---

## 7. Workflow List

Workflow List la man hinh quan ly cac workflow da luu tren may.

Chuc nang MVP:

- Xem danh sach workflow.
- Tao workflow moi.
- Mo workflow de sua.
- Xoa workflow.
- Run workflow.

Vi du:

```text
Workflows

[ + New Workflow ]

| Name              | Steps | Updated At | Actions          |
|-------------------|-------|------------|------------------|
| Login example.com | 7     | Today      | Open / Run / Del |
```

---

## 8. Workflow Builder

Workflow Builder la man hinh tao va sua step list cua mot workflow.

Layout MVP:

```text
---------------------------------------------------------
| Workflow name                            [Run Workflow] |
---------------------------------------------------------
| Steps list                         | Step detail form   |
|                                    |                    |
| 1. Open URL                        | Action: Type Text  |
| 2. Sleep                           | XPath              |
| 3. Type Text                       | Text               |
| 4. Type Text                       |                    |
| 5. Click                           | [Save Step]        |
| 6. Sleep                           | [Test Step]        |
| 7. Scroll                          | [Delete Step]      |
|                                    |                    |
| [ + Add Step ]                     |                    |
---------------------------------------------------------
```

Ben trai:

- Danh sach step theo thu tu chay.
- Click step nao thi chon step do.
- Drag and drop de sap xep lai step.
- Add Step them step moi vao cuoi workflow.

Ben phai:

- Form chi tiet cua step dang chon.
- Form thay doi theo action type.
- Co Save Step.
- Co Test Step.
- Co Delete Step.

Them step:

- Nguoi dung chon action type.
- Step moi duoc them vao cuoi danh sach.
- Sau khi them, step moi duoc chon tu dong.
- Form ben phai hien config cua step moi.

---

## 9. Action trong MVP

MVP chi co 5 action:

| Action | Muc dich |
|---|---|
| Open URL | Dieu huong browser toi mot URL |
| Sleep | Khong lam gi trong mot so giay |
| Type Text | Clear va nhap text vao element theo XPath |
| Click | Click element theo XPath |
| Scroll | Cuon trang theo so pixel |

Cac action de sau MVP:

- Select Option.
- Press Key.
- Wait Element.
- Get Text.
- Screenshot action.
- Upload File.
- Check Element Exists.
- Scroll To Element.

---

## 10. Chi tiet action MVP

### Open URL

Mo mot URL cu the.

Config:

```text
URL: https://example.com/login
```

Behavior MVP:

- Dieu huong browser den URL.
- Khong doi page load xong.
- Chay xong action la sang step tiep theo.
- Neu can cho trang load, nguoi dung them step Sleep phia sau.

---

### Sleep

Khong lam gi trong mot khoang thoi gian.

Config:

```text
Seconds: 3
```

Behavior MVP:

- Cho dung so giay da cau hinh.
- Het thoi gian thi sang step tiep theo.

Sleep la action quan trong trong MVP vi runner khong auto-wait.

---

### Type Text

Nhap text vao input hoac textarea theo XPath.

Config:

```text
XPath: //*[@name="email"]
Text: user@example.com
```

Behavior MVP:

- Tim XPath tai thoi diem step chay.
- Neu khong tim thay element thi fail ngay.
- Focus vao element.
- Clear noi dung hien co.
- Type text moi.
- Khong tu cho XPath xuat hien.
- Neu website can thoi gian load, nguoi dung them Sleep truoc do.

---

### Click

Click vao element theo XPath.

Config:

```text
XPath: //*[@type="submit"]
```

Behavior MVP:

- Tim XPath tai thoi diem step chay.
- Neu khong tim thay element thi fail ngay.
- Click element.
- Khong tu cho XPath xuat hien.
- Neu website can thoi gian load, nguoi dung them Sleep truoc do.

---

### Scroll

Cuon trang theo so pixel.

Config:

```text
Direction: down
Pixels: 500
```

Behavior MVP:

- Direction gom `down` hoac `up`.
- Pixels la so pixel can cuon.
- MVP chi scroll trang chinh.
- Chua ho tro scroll den element.
- Chua ho tro scroll trong container rieng.

---

## 11. Runner

Runner la phan thuc thi workflow.

MVP dung:

```text
Playwright + Chromium
```

Behavior chung:

- Khi Test Step hoac Run Workflow, app tu mo mot Chromium moi.
- Browser chay o che do headed de nguoi dung nhin thay.
- Browser moi khong dung session/cookie/localStorage cu.
- Chay xong, loi, hoac stop thi browser van giu mo.
- Nguoi dung dong browser thu cong khi khong can nua.
- MVP chua co headless mode.
- MVP chua chon browser.

Runner khong auto-wait:

- Open URL khong cho page load xong.
- Click khong cho XPath xuat hien.
- Type Text khong cho XPath xuat hien.
- Muon cho thi nguoi dung them Sleep.

---

## 12. Test Step

Test Step la chuc nang cua Workflow Builder, khong phai mot action trong workflow.

Khi nguoi dung chon mot step va bam Test Step:

```text
App mo Chromium moi
-> Chay workflow tu step 1
-> Dung o step dang duoc test
-> Bao success/failed/stopped
-> Giu browser mo
```

Vi du neu test step 5:

```text
Run step 1
Run step 2
Run step 3
Run step 4
Run step 5
Stop
```

Y nghia:

- Moi step duoc test trong dieu kien gan voi run that.
- Workflow phai du kha nang chay lai tu dau.
- Khong phu thuoc vao trang thai browser dang mo truoc do.

---

## 13. Run Workflow

Run Workflow chay toan bo step trong workflow.

Flow:

```text
Nguoi dung bam Run Workflow
-> App mo Chromium moi
-> Chay step tu dau den cuoi
-> Neu thanh cong: status success, giu browser mo
-> Neu loi: status failed, dung tai step loi, giu browser mo
-> Neu nguoi dung bam Stop: status stopped, giu browser mo
```

MVP chi cho mot lan Test/Run tai mot thoi diem.

Khi dang running:

- Disable nut Test Step.
- Disable nut Run Workflow.
- Hien nut Stop.
- Khong cho start run moi.

---

## 14. Stop Run

MVP can co nut Stop khi workflow dang chay.

Behavior:

- Stop dung runner hien tai.
- Cac step sau khong chay nua.
- Browser dang mo van giu nguyen trang thai hien tai.
- Status hien tai la `stopped`.

---

## 15. Trang thai va loi trong MVP

MVP chi can hien status tong cua lan Test/Run hien tai:

```text
idle
running
success
failed
stopped
```

Khong can Run History trong MVP.

Khi failed, app chi can bao toi thieu:

```text
Failed at step 4: XPath not found
Failed at step 2: Invalid URL
Failed at step 5: Browser was closed
```

Khong can trong MVP:

- Log chi tiet tung step.
- Status tung step.
- Screenshot khi loi.
- Output data.
- Export result.

---

## 16. Luu tru du lieu local

MVP luu du lieu tren may nguoi dung bang SQLite.

App dung migration de nang cap schema theo version.

Du lieu can luu:

- Workflows.
- Workflow steps.

Schema concept:

```text
workflows
- id
- name
- created_at
- updated_at

workflow_steps
- id
- workflow_id
- order_index
- type
- config_json
- created_at
- updated_at
```

Vi moi action co config khac nhau, `config_json` phu hop cho MVP.

Vi du step:

```json
{
  "type": "type_text",
  "config": {
    "xpath": "//*[@name=\"email\"]",
    "text": "user@example.com"
  }
}
```

Migration MVP:

- Tao bang `workflows`.
- Tao bang `workflow_steps`.
- Tao index theo `workflow_id` va `order_index`.
- Luu version migration da chay.

---

## 17. Huong ky thuat du kien

Tech stack phu hop:

```text
Electron + React + Playwright + SQLite
```

Vai tro:

| Thanh phan | Cong nghe |
|---|---|
| Desktop app | Electron |
| UI | React |
| Browser automation | Playwright |
| Browser engine MVP | Chromium |
| Local database | SQLite |
| Migration | SQLite migration layer |

Cau truc du lieu ung dung concept:

```text
app-data/
├── database.sqlite
└── migrations/
```

MVP chua can thu muc profiles, screenshots, downloads hay logs.

---

## 18. Nhung phan de sau MVP

Cac tinh nang sau huu ich nhung de sau:

- Profile theo nghia bo data/account rieng.
- Browser session persistence.
- Custom variables.
- Secret variables.
- Run History.
- Step-by-step logs.
- Screenshot action.
- Screenshot khi loi.
- Output data.
- Get Text.
- Select Option.
- Press Key.
- Wait Element.
- Upload File.
- Scroll To Element.
- Element picker.
- Recorder thao tac.
- Import/export workflow.
- Duplicate workflow.
- Run nhieu workflow.
- Chay song song.
- Scheduler.
- Headless mode.
- Chon browser Chrome/Edge.
- Proxy.
- Dashboard.
- Cloud sync.

---

## 19. Roadmap de xuat

### Version 0.1 - Workflow MVP

Muc tieu: tao workflow va chay duoc cac thao tac web co ban bang Chromium headed.

Bao gom:

- Workflow List.
- Workflow Builder 2 cot.
- Add/edit/delete step.
- Drag and drop sap xep step.
- Action Open URL.
- Action Sleep.
- Action Type Text by XPath.
- Action Click by XPath.
- Action Scroll by pixels.
- Test Step.
- Run Workflow.
- Stop Run.
- SQLite storage.
- Migration co ban.
- Status tong cua run hien tai.
- Failed message toi thieu.

### Version 0.2 - Debug va thao tac tot hon

Muc tieu: giup nguoi dung sua workflow de hon.

Co the them:

- Run History.
- Log tung step.
- Screenshot khi loi.
- Duplicate workflow.
- Better validation.
- Wait Element.
- Press Key.
- Select Option.

### Version 0.3 - Du lieu va profile

Muc tieu: chay cung mot workflow voi data khac nhau.

Co the them:

- Profile.
- Variables.
- Secret variables.
- Run workflow voi profile.
- Browser session persistence neu can.

### Version 0.4 - Nang cao

Muc tieu: tang nang luc automation.

Co the them:

- Element picker.
- Recorder.
- Import/export.
- Scheduler.
- Multi-run.
- Headless mode.
- Chon browser.

---

## 20. Chot y tuong hien tai

Ban concept hien tai nen hieu la:

> Mot app desktop giup nguoi dung tao workflow gom cac step thao tac web co ban, sau do Test hoac Run workflow bang Chromium headed do app tu mo doc lap.

MVP that gon:

```text
Workflow List
+ Workflow Builder
+ Open URL / Sleep / Type Text / Click / Scroll
+ Test Step
+ Run Workflow
+ Stop Run
+ SQLite + migration
```

Khi loi workflow runner nay on dinh, app moi nen mo rong sang Profile, variables, run history, output/debug, recorder, element picker va cac tinh nang automation nang cao.
