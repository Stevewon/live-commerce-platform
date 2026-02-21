#!/bin/bash

# 모든 동적 라우트 파일 찾기
find app/api -name "route.ts" -path "*/[*]/*" | while read -r file; do
  echo "Fixing: $file"
  
  # { params }: { params: { 를 { params }: { params: Promise<{ 로 변경
  sed -i 's/{ params }: { params: {/{ params }: { params: Promise<{/g' "$file"
  
  # 함수 시작 후 const { 변수 } = params; 패턴 찾아서 await 추가
  # 이 부분은 수동으로 해야 할 수도 있음
done

echo "Done!"
