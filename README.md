# chungnx-pi-setup

**Bản chụp cấu hình [`pi`](https://github.com/earendil-works/pi) của tôi — clone về là dựng lại được toàn bộ 21 extension trên máy mới.**

pi `0.85.1` · Node `24` · Windows (Git Bash) · cập nhật 2026-09-17

---

## Repo này để làm gì

`pi` không có chức năng export/import cấu hình. Repo này là cách mang **toàn bộ setup** sang máy khác mà không phải chép cache.

Cơ chế: `settings.json` có mảng `packages`; `pi` đọc mảng đó lúc khởi động và tự `npm install` những gì còn thiếu. Mang được manifest là mang được cả bộ extension.

Những thứ **cố tình không** đưa vào repo:

| Không có | Vì sao |
|---|---|
| `~/.pi/agent/npm/` | cache, `pi` tự cài lại từ `settings.json` |
| `~/.pi/agent/auth.json` | **chứa API key + OAuth token** — đăng nhập lại trên máy mới |
| `sessions/`, `missions/` | lịch sử và state theo máy |
| `model-fallback/state.json` | state cooldown theo máy, không phải setup |

---

## Dựng lại trên máy mới

```bash
# 1) cài pi đúng phiên bản
npm i -g @earendil-works/pi-coding-agent@0.85.1

# 2) clone
git clone <repo-url> && cd chungnx-pi-setup

# 3) diễn tập vào thư mục tạm — không đụng gì tới cấu hình thật
./scripts/pi-setup-restore.sh --from-config config --scratch --install --verify

# 4) làm thật
./scripts/pi-setup-restore.sh --install --verify
```

Sau đó đăng nhập lại provider (auth không nằm trong repo):

```
/login    # trong pi, cho openai-codex và anthropic
```

> **Windows:** script là **bash** → chạy trong **Git Bash** (hoặc WSL), **không phải** PowerShell/cmd.

---

## Dùng hằng ngày

> Mọi lệnh chạy trong **Git Bash**, không phải PowerShell.

### Bắt đầu một dự án mới

```bash
~/Projects/chungnx-pi-setup/scripts/new-project.sh --personal ~/Projects/abc
~/Projects/chungnx-pi-setup/scripts/new-project.sh --work /d/work/du-an-x --agents
```

Script gom các bước hay quên: chuyển `gh` sang đúng tài khoản, `git init -b main`, khai báo `user.name`/`user.email` ở mức **`--local`**, và — chỉ với `--personal` — vá `credential.helper` để push repo private không dính lỗi `Repository not found`.

| Cờ | |
|---|---|
| `--personal` | tài khoản `XuanChungNguyen`, email noreply, kèm vá credential |
| `--work` | tài khoản `ibim-lab`, email `ibim@innojsc.com` |
| `--agents` | tạo thêm `AGENTS.md` mẫu nếu chưa có |
| `--dry-run` | chỉ in ra dự định, không ghi gì |

Thư mục mặc định là thư mục hiện tại; thư mục chưa tồn tại sẽ được tạo. Xong thì chạy `pi` — lần đầu nó hỏi có tin thư mục này không.

### Vừa đổi cấu hình → lưu lại (dùng nhiều nhất)

Mỗi khi chỉnh `/advisor-settings`, đổi model, thêm/bớt extension:

```bash
cd ~/Projects/chungnx-pi-setup
./scripts/pi-setup-backup.sh --config-dir config    # máy → repo
git diff                                            # xem đúng cái vừa đổi chưa
git add -A && git commit -m "chore(config): <mô tả>"
git push
```

`git diff` là bước đáng giá nhất: config là JSON phẳng nên thấy chính xác thứ gì đã đổi — kể cả thứ extension tự ghi mà mình không biết.

### Cấu hình hỏng → quay về bản đã lưu

```bash
./scripts/pi-setup-restore.sh --dry-run            # xem sẽ ghi đè gì
./scripts/pi-setup-restore.sh --install --verify   # làm thật
```

Script tự snapshot file cũ thành `*.bak.<timestamp>` trước khi đè.

### Muốn thử nghiệm mà không sợ hỏng

```bash
./scripts/pi-setup-restore.sh --from-config config --scratch --install
```

`--scratch` tạo thư mục tạm bằng `mktemp -d` rồi trỏ `PI_CODING_AGENT_DIR` vào đó — setup thật không bị đụng.

### Kiểm tra sức khoẻ

```bash
node scripts/pi-setup-verify-advisor.mjs --live   # advisor.json còn đúng schema
pi list                                          # 21 extension còn đủ
/model-fallback:status                           # có đang bị fallback không
/cost                                            # chi phí, gồm phần Advisor
```

### Cờ opt-in của backup (mặc định **không** lấy)

| Cờ | Lấy thêm | Cảnh báo |
|---|---|---|
| `--memory` | `memory/` | |
| `--skills` | `skills/` | 24 MB |
| `--sessions` | lịch sử chat | ~56 MB |
| `--missions` | state `pi-goal-x` | **có thể chứa tên khách hàng** |
| `--auth` | `auth.json` | ⚠️ **chứa credential — đừng commit, kể cả repo private** |

Thêm `--dry-run` vào bất kỳ lệnh nào để chỉ in ra dự định, không ghi gì.

---

## Setup này là của máy, không phải của dự án

Cấu hình `pi` nằm ở `~/.pi/agent/`, dùng chung cho mọi thư mục. **Mở dự án mới không cần làm gì** — 21 extension đã có sẵn.

Cái gì chỉnh được theo từng dự án, cái gì không:

| Thứ | Theo dự án? | Cách làm |
|---|---|---|
| Extension bật/tắt | ✅ | `pi config -l` → `<dự-án>/.pi/settings.json` |
| Hướng dẫn cho agent | ✅ | `AGENTS.md` hoặc `CLAUDE.md` ở gốc dự án |
| Git identity | ✅ | `git config --local user.email ...` |
| Cấu hình advisor | ❌ | **Chỉ global** — `pi-advisor-flow` cố ý không cho repo tự đổi |
| Model mặc định | ❌ | Global, hoặc `pi --model <...>` cho từng lần chạy |
| `pi-lens` | ❌ | Global ở `~/.pi-lens/config.json` |

Lách cho từng phiên: `pi --model anthropic/claude-sonnet-5`, hoặc `pi -xt ask_advisor` để bỏ tool advisor cho lần chạy đó.

Máy này **không có git identity ở mức global** (cố ý, để tách bạch tài khoản cá nhân và công ty) → mỗi repo mới phải `git config --local` riêng, nếu không commit sẽ báo lỗi.

---

## Bảo trì định kỳ

| Khi nào | Làm gì |
|---|---|
| Sau `pi update` | `node scripts/pi-lens-compact-lsp-status.mjs --check` — bản vá pi-lens bị ghi đè (chỉ cần nếu dùng nerd icon) |
| Khi nâng `pi` | Cập nhật số phiên bản trong README và `lastChangelogVersion` của `settings.json` |
| Trước việc công ty | `gh auth status` → `gh auth switch --user ibim-lab` |

> **Repo này không tự đồng bộ.** Chỉnh cấu hình trong `pi` thì máy đổi, repo vẫn cũ cho tới khi chạy `backup.sh`. Để lệch lâu rồi mới `restore` là mất phần chỉnh ở giữa — chỉnh xong cái gì thì backup + commit ngay, coi như "lưu game".

---

## 21 extension

| # | Package | Version | Làm gì |
|---|---|---|---|
| 1 | `pi-web-access` | 0.29.0 | web search, tải URL, clone repo GitHub, đọc PDF, hiểu video |
| 2 | `pi-smart-fetch` | 0.3.17 **(ghim)** | `web_fetch` với TLS fingerprint của trình duyệt desktop → qua được trang chặn bot |
| 3 | `pi-mcp-adapter` | 2.34.0 | cắm MCP server |
| 4 | `pi-subagents` | 0.68.0 | giao việc cho agent phụ, workflow nhiều agent |
| 5 | `pi-background-tasks` | 2.5.0 | chạy lệnh shell nền, agent chỉ-đọc |
| 6 | `pi-goal-x` | 0.31.5 | `/goal` — mục tiêu, tiến độ bền qua nhiều phiên, auditor kiểm tra |
| 7 | `pi-memory` | 0.4.2 | bộ nhớ + tìm kiếm ngữ nghĩa |
| 8 | `pi-worktree` | 1.3.3 | quản lý git worktree |
| 9 | `pi-simplify` | 0.2.3 | soi code vừa sửa về độ rõ ràng, dễ bảo trì |
| 10 | `pi-lens` | 4.2.0 | LSP: chẩn đoán lỗi, điều hướng symbol, `symbol_search` |
| 11 | `pi-footer` | 0.5.1 | statusline nhiều dòng |
| 12 | `pi-model-fallback` | 0.4.0 | đổi model theo rule khi provider lỗi 429/5xx |
| 13 | `pi-advisor-flow` | 0.6.0 | luồng Executor/Advisor — ý kiến thứ hai ở các cổng duyệt |
| 14 | `@narumitw/pi-usage` | 0.60.8 | hiển thị mức tiêu thụ tài khoản |
| 15 | `@tmustier/pi-session-recap` | 0.5.0 | tóm tắt "trong lúc bạn vắng mặt" |
| 16 | `@99percentpeople/pi-todo` | 1.2.7 | todo tối giản, state sống sót qua compaction |
| 17 | `@juicesharp/rpiv-ask-user-question` | 2.10.1 | hỏi bằng trắc nghiệm thay vì đoán |
| 18 | `@juicesharp/rpiv-btw` | 2.10.1 | `/btw` — hỏi nhanh không làm bẩn hội thoại |
| 19 | `@pi-unipi/notify` | 2.20.1 | thông báo khi agent xong/lỗi (⚠ config chứa credential — không backup) |
| 20 | `pi-browser-use` | 0.11.7 | agent điều khiển Chrome qua `chrome-devtools-mcp` |
| 21 | `@injaneity/pi-computer-use` | 0.5.1 | điều khiển ứng dụng desktop qua accessibility API |

Bản gốc có 22 — repo này **bỏ `pi-powerline-footer`** (chỉ cài để tắt, không dùng).

> Version là **để tham khảo tại thời điểm chụp**; nguồn sự thật là `config/settings.json`. Chỉ `pi-smart-fetch` bị ghim cứng.

---

## Cấu hình model

Ba file phối hợp với nhau, phải nhất quán:

```
settings.json  defaultModel = openai-codex/gpt-5.6-sol   ┐ khớp nhau
advisor.json   executor     = openai-codex/gpt-5.6-sol   ┘
advisor.json   advisor      = anthropic/claude-opus-5
```

**Ý đồ:** model nhanh làm mọi lượt, model mạnh chỉ vào cuộc ở các cổng duyệt (trước khi lập kế hoạch, sau thất bại lặp lại, trước khi tuyên bố xong). Hai model **khác provider** để ý kiến thứ hai thực sự độc lập.

### `pi-advisor-flow`

| Khoá | Giá trị | Vì sao |
|---|---|---|
| `advisorEffort` | `low` | đủ dùng, rẻ |
| `advisorScoutEnabled` | `false` | Scout là **experimental**, tốn thêm một lượt gọi model trước mỗi lần hỏi Advisor |
| `gateFailureMode` | `warn-and-continue` | cổng duyệt trục trặc thì cảnh báo rồi đi tiếp, không chặn việc |
| `advisorRedactSecrets` | `true` | che secret trước khi gửi sang Advisor |

### `pi-model-fallback`

```
openai-codex gặp 429/500/502/503/504  →  anthropic/claude-sonnet-5
cooldownMs: 18000000  (5 giờ)
```

Hai điều cần nhớ:

- **Chuyển tự động, không hỏi.** `autoRetry` còn tự chạy lại câu hỏi vừa thất bại trên model mới.
- **Cooldown mặc định của 429 là 72 giờ** — quá dài so với cửa sổ 5 giờ của codex, nên rule này đặt `cooldownMs` 5 giờ.

Fallback cố ý trỏ vào `claude-sonnet-5` chứ không phải `claude-opus-5`: Advisor đã nằm trên Opus 5, nếu executor cũng fallback sang đó thì khi anthropic nghẽn **cả hai vai cùng chết**.

```
/model-fallback:status    # đang fallback không, còn bao lâu
/model-fallback:reset     # quay lại model gốc ngay
```

### `pi-lens`

Config nằm ở `~/.pi-lens/config.json` — **ngoài** config dir của pi, nên `external-configs.txt` làm bản đồ chỉ đường khi restore.

```json
{
  "lsp":     { "enabled": true },
  "widget":  { "visible": false },
  "format":  { "enabled": false },
  "autofix": { "enabled": false }
}
```

`format` và `autofix` mặc định của package là `true` — nghĩa là nó **tự format và tự sửa code bạn đang viết**. Ở đây tắt cả hai; chỉ giữ LSP.

---

## Chưa cấu hình (làm khi cần)

| Extension | Cần gì |
|---|---|
| `pi-footer` | layout statusline. Mặc định `iconMode: "emoji"` chạy được với font thường; chỉ `"nerd"` mới cần Nerd Font |
| `@pi-unipi/notify` | token Gotify/Telegram — `/unipi:notify-set-gotify`, `/unipi:notify-set-tg` |
| `@injaneity/pi-computer-use` | setup lần đầu **bắt buộc trong phiên `pi` tương tác**; ở chế độ `-p` extension nằm im |

---

## Trong repo có gì

```
chungnx-pi-setup/
├── README.md
├── .gitattributes                   ép *.sh dùng LF (cần cho Windows)
├── scripts/
│   ├── pi-setup-backup.sh           đóng gói setup của máy hiện tại
│   ├── pi-setup-restore.sh          dựng lại trên máy mới
│   ├── pi-setup-verify-advisor.mjs  kiểm advisor.json theo schema thật của extension
│   ├── pi-lens-compact-lsp-status.mjs  vá pi-lens cho dòng LSP gọn lại
│   └── new-project.sh               khởi tạo git cho dự án mới, đúng danh tính
└── config/                          bản chụp setup (plain file, git-diff được)
    ├── .pi-setup-exclude           glob loại trừ khi mirror
    ├── settings.json               manifest 21 package + model/theme/compaction
    ├── advisor.json                config pi-advisor-flow
    ├── model-fallback/config.json  rule fallback
    ├── models-store.json           catalog model (đỡ phải chờ refresh 4 tiếng)
    ├── pi-lens-config.json         config pi-lens (thật ra nằm ở ~/.pi-lens/)
    └── external-configs.txt        manifest: file nào đi đâu khi restore
```

---

## Ghi chú

**Nguồn gốc script.** Bốn script trong `scripts/` lấy từ [`zuey-pi-setup`](https://github.com/mrgoonie/zuey-pi-setup) của mrgoonie. Repo đó **không kèm giấy phép** ("all rights belong to the author"), nên repo này để **private**. Nếu sau này muốn chuyển sang public thì phải xin phép tác giả hoặc thay bằng script tự viết.

**Đây là snapshot cá nhân**, không phải sản phẩm chính thức của `pi` hay của bất kỳ package nào liệt kê ở trên. Các extension bên thứ ba giữ giấy phép riêng của chúng.
