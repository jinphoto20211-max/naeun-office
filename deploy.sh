#!/usr/bin/env bash
# 나은 비서실 — 이후 수정분 배포용 (GitHub Pages는 이미 켜져 있음: main /(root))
# 사용법: work/naeun-office/index.html 을 고친 뒤 이 스크립트를 실행하면 1~2분 안에 사이트에 반영됩니다.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

git add -A ':!notes.md' ':!template.html' ':!*.md'
git -c user.name="jinphoto20211-max" -c user.email="jinphoto20211-max@users.noreply.github.com" \
  commit -m "${1:-나은 비서실 업데이트}" || echo "커밋할 변경 없음"
git push origin main

echo "== Pages 상태 =="
gh api repos/jinphoto20211-max/naeun-office/pages --jq '.status,.html_url'
sleep 20
echo -n "HTTP: "
curl -s -o /dev/null -w "%{http_code}\n" -L https://jinphoto20211-max.github.io/naeun-office/
