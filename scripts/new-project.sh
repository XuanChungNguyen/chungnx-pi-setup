#!/usr/bin/env bash
#
# new-project.sh — khởi tạo git cho một dự án mới, đúng danh tính theo bên sở hữu
#
# Vì sao cần: máy này CỐ Ý không có git identity ở mức --global (để tách bạch
# tài khoản cá nhân và tài khoản công ty). Hệ quả là mỗi repo mới đều phải khai
# báo user.name/user.email riêng, nếu không lần commit đầu sẽ bị từ chối.
# Script gom các bước đó lại để không phải nhớ.
#
# Dùng:
#   ./scripts/new-project.sh --personal ~/Projects/abc
#   ./scripts/new-project.sh --work /d/work/du-an-x --agents
#   ./scripts/new-project.sh --work --dry-run          # thư mục hiện tại
#
set -euo pipefail

# --- Danh tính: sửa ở đây nếu đổi tài khoản ---
GIT_NAME="XuanChungNguyen"

PERSONAL_GH="XuanChungNguyen"
PERSONAL_EMAIL="79657145+XuanChungNguyen@users.noreply.github.com"

WORK_GH="ibim-lab"
WORK_EMAIL="ibim@innojsc.com"

MODE=""
TARGET="."
DO_AGENTS=0
DRY_RUN=0

info() { printf '%s\n' "$*"; }
warn() { printf '⚠  %s\n' "$*" >&2; }
die() { printf '✗  %s\n' "$*" >&2; exit 1; }
run() {
	if [ "$DRY_RUN" -eq 1 ]; then
		printf '   [dry-run] %s\n' "$*"
	else
		"$@"
	fi
}

usage() {
	cat <<'EOF'
Dùng: new-project.sh (--personal|--work) [thư-mục] [tùy chọn]

  --personal      Dự án CÁ NHÂN  → tài khoản XuanChungNguyen, email noreply của GitHub
                  Kèm vá credential.helper (xem ghi chú bên dưới)
  --work          Dự án CÔNG TY  → tài khoản ibim-lab, email ibim@innojsc.com
  --agents        Tạo thêm AGENTS.md mẫu nếu chưa có
  --dry-run       Chỉ in ra sẽ làm gì, không ghi gì
  -h, --help      In hướng dẫn này

Thư mục mặc định là thư mục hiện tại. Thư mục chưa tồn tại sẽ được tạo.

Ghi chú về credential.helper (chỉ với --personal):
  Máy dùng Git Credential Manager ở mức system, và GCM giữ credential của tài
  khoản công ty độc lập với gh. Push lên repo PRIVATE của tài khoản cá nhân sẽ
  fail với "remote: Repository not found" (GitHub trả 404 thay vì 403 cho repo
  private). Script đặt sẵn credential.helper dùng gh cho repo đó — trong đó dòng
  chuỗi rỗng là bắt buộc, nó reset danh sách helper kế thừa từ system.
EOF
}

while [ $# -gt 0 ]; do
	case "$1" in
		--personal) MODE="personal"; shift ;;
		--work) MODE="work"; shift ;;
		--agents) DO_AGENTS=1; shift ;;
		--dry-run) DRY_RUN=1; shift ;;
		-h | --help) usage; exit 0 ;;
		-*) usage >&2; die "tham số không hợp lệ: $1" ;;
		*) TARGET="$1"; shift ;;
	esac
done

[ -n "$MODE" ] || { usage >&2; die "thiếu --personal hoặc --work"; }
command -v git >/dev/null 2>&1 || die "không tìm thấy lệnh 'git'"

if [ "$MODE" = "personal" ]; then
	WANT_GH="$PERSONAL_GH"; EMAIL="$PERSONAL_EMAIL"
else
	WANT_GH="$WORK_GH"; EMAIL="$WORK_EMAIL"
fi

info "→ chế độ: $MODE  ·  $GIT_NAME <$EMAIL>"

# --- Thư mục ---
# Dry-run với thư mục chưa tồn tại thì không cd được; đánh dấu lại để bước kiểm
# tra git bên dưới không soi nhầm thư mục đang đứng.
DIR_EXISTS=1
if [ ! -d "$TARGET" ]; then
	DIR_EXISTS=0
	info "→ tạo thư mục: $TARGET"
	run mkdir -p "$TARGET"
fi
if [ -d "$TARGET" ]; then
	cd "$TARGET"
	info "→ thư mục: $(pwd)"
else
	info "→ thư mục: $TARGET  (chưa tạo — dry-run)"
fi

# --- Tài khoản gh ---
if command -v gh >/dev/null 2>&1; then
	CURRENT_GH="$(gh api user --jq .login 2>/dev/null || echo "")"
	if [ -z "$CURRENT_GH" ]; then
		warn "gh chưa đăng nhập — bỏ qua bước chuyển tài khoản"
	elif [ "$CURRENT_GH" != "$WANT_GH" ]; then
		info "→ chuyển gh: $CURRENT_GH → $WANT_GH"
		run gh auth switch --user "$WANT_GH"
	else
		info "→ gh đã đúng tài khoản: $CURRENT_GH"
	fi
else
	warn "không có lệnh 'gh' — bỏ qua bước chuyển tài khoản"
fi

# --- git init ---
if [ "$DIR_EXISTS" -eq 1 ] && [ -d .git ]; then
	info "→ đã là git repo, không init lại"
else
	info "→ git init (nhánh main)"
	run git init -b main -q
fi

# --- Danh tính, chỉ ở mức repo ---
info "→ đặt user.name / user.email ở mức --local"
run git config --local user.name "$GIT_NAME"
run git config --local user.email "$EMAIL"

# --- credential.helper: chỉ cần cho repo private của tài khoản cá nhân ---
if [ "$MODE" = "personal" ]; then
	info "→ đặt credential.helper dùng gh (tránh GCM trả credential tài khoản công ty)"
	run git config --local --unset-all credential.helper || true
	run git config --local --add credential.helper ""
	run git config --local --add credential.helper '!gh auth git-credential'
fi

# --- AGENTS.md ---
if [ "$DO_AGENTS" -eq 1 ]; then
	if [ -f AGENTS.md ]; then
		warn "AGENTS.md đã có — không ghi đè"
	else
		info "→ tạo AGENTS.md mẫu"
		if [ "$DRY_RUN" -eq 1 ]; then
			printf '   [dry-run] ghi AGENTS.md\n'
		else
			printf '# %s
' "$(basename "$(pwd)")" > AGENTS.md
			cat >> AGENTS.md <<'AGENTSEOF'

## Bối cảnh

Dự án làm gì, phục vụ ai, ràng buộc nào quan trọng.

## Cách chạy

```bash
# build / test / chạy local
```

## Quy ước

- Thư mục nào là generated (đừng sửa tay)
- Thứ gì không được đụng vào
- Quy ước đặt tên, format commit
AGENTSEOF
		fi
	fi
fi

info ""
info "✓ xong. Bước tiếp theo:"
info "    pi                      # lần đầu sẽ hỏi có tin thư mục này không"
if [ "$MODE" = "personal" ]; then
	info "    gh repo create <tên> --private --source=. --remote=origin --push"
else
	info "    gh repo create <org>/<tên> --private --source=. --remote=origin --push"
fi
