# Pi setup template

Bộ cấu hình Pi có phiên bản, profile, backup/restore và rollback. Dùng trực tiếp
trên PowerShell, Git Bash, Linux hoặc macOS qua Node CLI.

**Trạng thái: bản ứng viên 0.1.0, chưa phát hành.** Đọc [điều kiện phát hành](docs/RELEASE-CHECKLIST.md)
và [nguồn gốc/giấy phép](RIGHTS.md). Không xem test cấu hình là bằng chứng mọi extension
đã chạy thành công hoặc tài khoản model đã hoạt động.

## Bắt đầu

Cần Node **24.18.0+ trong nhánh 24**. Cài Git nếu dùng chức năng khởi tạo dự án.
Không cần cài Pi global; runtime được cài riêng trong thư mục Pi được chọn.

Một lệnh sau khi clone (thay model bằng ID dùng được với tài khoản của bạn):

```bash
node scripts/pi-setup.mjs setup --profile minimal --provider openai-codex --model gpt-5.6-sol
```

Lệnh này restore, cài runtime và verify. Thêm `--dry-run` để xem trước hoặc
`--scratch` để chỉ thử khôi phục file. Nếu muốn kiểm tra từng bước:

```bash
git clone https://github.com/XuanChungNguyen/chungnx-pi-setup.git
cd chungnx-pi-setup

# Thay provider/model bằng ID tài khoản của bạn sử dụng được
node scripts/pi-setup.mjs configure --profile minimal --provider openai-codex --model gpt-5.6-sol
node scripts/pi-setup.mjs doctor --from-config .local/config --strict
node scripts/pi-setup.mjs restore --from-config .local/config --scratch

# Đóng Pi trước khi áp dụng; xem thay đổi rồi mới ghi
node scripts/pi-setup.mjs restore --from-config .local/config --dry-run
node scripts/pi-setup.mjs restore --from-config .local/config --install --verify
```

Restore in đường dẫn journal để quay lui. Install chạy `npm ci --ignore-scripts`
từ lockfile đã lưu; lỗi install hoặc verify trả mã lỗi. Sau đó mở Pi, `/login`
cho provider đã chọn. Executable nằm trong:

```text
<PI_DIR>/npm/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js
```

Chạy bằng `node <đường-dẫn-trên>`. `PI_DIR` mặc định là `~/.pi/agent`, hoặc
`PI_CODING_AGENT_DIR`. Khi chạy Pi với thư mục tùy chọn, đặt biến môi trường này
đúng đích; `--target` của setup không thay môi trường shell của bạn.

## Profile và phiên bản

| Profile | Nội dung |
|---|---|
| `minimal` | Pi core, không extension; phù hợp kiểm chứng cài đặt ban đầu |
| `coding` | 6 extension: subagents, simplify, lens, advisor, fallback, hỏi người dùng |
| `full` | 17 extension từ snapshot qua được kiểm tra peer dependency và audit mức cao |

`template.json` là manifest phiên bản trực tiếp. `runtime/<profile>/package-lock.json`
ghim cả dependency gián tiếp và integrity. Không dùng `--force`/`--legacy-peer-deps`.
Bốn package bị loại khỏi profile mới: `pi-background-tasks@2.5.0`,
`pi-goal-x@0.31.5`, `@pi-unipi/notify@2.20.1` có peer range không nhận Pi 0.85.1;
`pi-worktree@1.3.3` kéo Pi 0.73.1 đã deprecated và dependency có cảnh báo bảo mật mức cao.

```bash
node scripts/pi-setup.mjs configure --profile coding --provider openai-codex --model gpt-5.6-sol --advisor anthropic/claude-opus-5 --output .local/coding
```

Configure chỉ ghi vào thư mục rỗng; tạo thư mục mới khi đổi profile/nâng cấp.
Fallback mặc định tắt để tránh tự chuyển dữ liệu sang provider khác. Advisor bật
redaction và tắt gửi nội dung file tracked/untracked mặc định; vẫn cần xem xét
dữ liệu hội thoại gửi tới provider. `warn-and-continue` là cổng tư vấn, không phải
bảo đảm đã được reviewer duyệt.

Full có prerequisite riêng: pi-smart-fetch yêu cầu Bun >=1.3.0; browser/desktop
và native modules cần thiết lập theo tài liệu của extension. Vì install tắt lifecycle
scripts, một số tính năng native cần bước chuẩn bị riêng. Không bật lại tất cả
scripts một cách mù quáng chỉ để làm kiểm tra thành công.

## Backup, restore và rollback

```bash
node scripts/pi-setup.mjs backup --output .local/my-setup.bundle.json
node scripts/pi-setup.mjs backup --config-dir .local/export
node scripts/pi-setup.mjs restore --bundle .local/my-setup.bundle.json --dry-run
node scripts/pi-setup.mjs restore --bundle .local/my-setup.bundle.json
node scripts/pi-setup.mjs rollback --journal PATH_PRINTED_BY_RESTORE --dry-run
node scripts/pi-setup.mjs rollback --journal PATH_PRINTED_BY_RESTORE
```

Nâng cấp có nguồn rõ ràng và xem trước:

```bash
node scripts/pi-setup.mjs upgrade --from-config .local/new-version --dry-run
node scripts/pi-setup.mjs upgrade --from-config .local/new-version --install --verify
```

- Backup chỉ lấy setup được khai báo, không lấy auth, sessions, missions, memory,
  npm cache hay model catalog cache. Secret khả nghi chặn xuất và không in giá trị.
- Bundle là JSON có SHA-256 từng file; phát hiện hỏng dữ liệu, **không xác thực tác giả**.
- Scratch chỉ copy file vào HOME tạm, kể cả Pi Lens; không chạy Pi hoặc extension.
  `--scratch --install/--verify` bị từ chối. Thư mục được giữ để kiểm tra, có thể xóa sau.
- Dry-run không ghi. Symlink/junction và đường dẫn nguồn/đích chồng nhau bị từ chối.
- Mỗi giao dịch lưu nội dung trước đó của mọi file bị tác động. Lỗi ghi sẽ thử
  khôi phục tự động; journal vẫn được giữ. Rollback bảo vệ các chỉnh sửa mới hơn.
- Journal nằm ở `~/.pi-setup/journals`, có thể chứa dữ liệu nhạy cảm cũ; không commit
  hoặc chia sẻ. Không dùng journal của người khác.
- Rollback chỉ phục hồi file cấu hình. Chạy lại install để dựng node_modules theo
  lockfile cũ. Đóng mọi phiên Pi/setup đang chạy trước khi đổi cấu hình.

Xem [migration và xử lý gián đoạn](docs/MIGRATION.md). Tarball cũ và các cờ xuất
credential/state không còn được hỗ trợ; không có chuyển đổi ngầm.

## Kiểm tra sức khỏe

```bash
node scripts/pi-setup.mjs doctor --from-config .local/config --strict
node scripts/pi-setup.mjs doctor --live
node scripts/pi-setup.mjs doctor --live --smoke             # timeout mặc định 60 giây
node scripts/pi-setup.mjs doctor --live --smoke --timeout 120  # profile full/máy chậm
```

`doctor` kiểm JSON, phiên bản package, tham chiếu model; `--strict` kiểm lockfile;
`--live` đối chiếu phiên bản đã cài. Auth được kiểm sự hiện diện, không đọc/in token
và không chứng minh đăng nhập còn hiệu lực. `--smoke` chạy Pi và extension, gửi RPC
`get_state`, không gửi prompt model. Chỉ chạy với extension đã tin cậy; đây không phải sandbox.
`--timeout` nhận 1..300 giây và chỉ giới hạn probe RPC.

## Workflow ba vai trò

```bash
node scripts/team.mjs --task-file task.md --project PATH_TO_PROJECT --model openai-codex/gpt-5.6-sol --review-model anthropic/claude-opus-5 --dry-run
```

Bỏ `--dry-run` để thực thi sau khi cấu hình auth. Planner/reviewer chỉ có công cụ
đọc; implementer có công cụ sửa file và shell. Runner tắt auto-discovery extension,
skills, prompt templates và không tự phê duyệt tài nguyên dự án. Hướng dẫn vai trò
nằm trong `templates/agents/`; đây là workflow riêng, không phụ thuộc pi-subagents.

Tối đa **3 phiên gọi Pi**, mặc định **300 giây/pha** (`--timeout` đổi trong 1..1800).
Không tự chạy lại khi lỗi hoặc reviewer yêu cầu sửa. Reviewer phải kết thúc bằng
`VERDICT: PASS`; verdict thiếu/sai không được xem là thành công. Kết quả và trạng thái
lưu trong `.local/runs/`. Giới hạn này **không phải hard cap USD/token/API requests**;
Transcript JSONL giữ tool events và báo cáo usage từ provider để đối chiếu chi phí;
mỗi pha có thể thực hiện nhiều lượt model/tool. Đặt hạn mức tại provider nếu cần
trần chi phí cứng. Timeout không thay sandbox hệ điều hành hoặc bảo đảm dọn mọi
process con do shell tạo. Chạy trong worktree/môi trường phù hợp và xem diff sau đó.

## Khởi tạo dự án

```bash
node scripts/pi-setup.mjs project --project PATH_TO_PROJECT --name YOUR_NAME --email YOUR_EMAIL --agents
```

Chỉ đổi Git identity local, không chuyển tài khoản `gh`, không đổi credential helper
hay ghi đè PowerShell profile. Hỗ trợ repo/worktree hiện hữu; không ghi đè AGENTS.md.
Điền bối cảnh và lệnh test trong AGENTS.md trước khi giao việc.

## Bảo trì và cấu trúc

```bash
npm run check
npm test
npm run doctor
```

```text
scripts/pi-setup.mjs       CLI đa nền tảng
scripts/lib/setup.mjs     kiểm tra file, backup, journal, rollback
scripts/team.mjs          workflow hữu hạn với bằng chứng từng pha
config/                   cấu hình minimal mặc định và runtime lock
runtime/                  manifest + lock cho từng profile
templates/                cấu hình, hướng dẫn dự án và vai trò mẫu
tests/                    regression tests không cần model/API key
.github/workflows/ci.yml   kiểm thử đa nền tảng và cài từ lockfile
docs/                     migration, điều kiện phát hành
```

Nâng phiên bản trong manifest rồi tạo lại lock của profile liên quan, chạy tests/CI,
thử trên máy sạch, cập nhật changelog và phát hành có phiên bản. Không sửa trực tiếp
lockfile để né xung đột. Snapshot cá nhân và helper cũ không nằm trong cây phát hành;
có thể tra cứu trong lịch sử Git khi thật sự cần.
