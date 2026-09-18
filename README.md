# Vision AI 검사 콘솔 — 웹 UI/UX 시안

화이트보드 스케치(S/N 입력 → 위치 선택 → 검사 → 결과 → Fail 당시 화면)와 장비 디스플레이 사진을 바탕으로 만든 웹 UI 시안입니다.
카메라 입력 패널은 실제 장비 사진 위에 **숫자 감지 영역(ROI)** 을 겹쳐 보여주고, 읽은 값을 기준값과 비교해 Pass/Fail을 기록합니다.

## 열기

`index.html`을 브라우저에서 열면 됩니다. 빌드·설치·외부 네트워크가 필요 없습니다.

- `index.html?screen=running` 처럼 `screen` 값을 주면 해당 화면의 샘플 상태로 시작합니다.
- `&preview=1` 을 붙이면 아래의 시안용 도구 막대를 숨깁니다.

| screen 값 | 화면 |
| --- | --- |
| `serial` | 01 · S/N 입력 (Cancel / OK) |
| `position` | 02 · 위치 선택 (1·2 나란히, 3은 오른쪽 끝) |
| `ready` | 03 · 검사 준비 (▷ ⏸ ◻, 현재 개수 / 100) |
| `running` | 04 · Vision AI 감지 중 |
| `paused` | 05 · 일시정지 |
| `stop` | 06 · 중지 확인 (◻ → 위치 완료 표시) |
| `position-progress` | 07 · 위치 1 완료 후 위치 선택 |
| `position-done` | 08 · 세 위치 완료 → 결과 보러 가기 |
| `results` | 09 · 결과 (1-MP, 1-Normal … 탭, 표, 업로드) |
| `fail-detail` | 10 · Fail 행 클릭 → Fail 당시 화면 |

## 숫자 감지 (카메라 입력 패널)

`assets/device-sample.jpg`(장비 디스플레이 사진) 위에 11개의 ROI를 그립니다. 좌표는 원본 사진(2000×1500) 픽셀 기준이며 `app.js`의 `FIELDS` 배열에 있습니다.

| 항목 | 사진의 값 | 판정 |
| --- | --- | --- |
| Energy | 1.0 | 기준값 비교 |
| J/shot | 16.67 | 기준값 비교 |
| Booster | 3.0 mm | 기준값 비교 |
| Repeat | 0.1 s | 기준값 비교 |
| Length | 25 mm | 기준값 비교 |
| Mode | MP / Normal | 기준값 비교 |
| Status | STANDBY | 기준값 비교 |
| Remain · Current · Total · Shot count | 118 · 436 · 436 · 436/300 | 기록만 |

기준값이 있는 항목이 모두 일치하면 Pass, 하나라도 다르면 Fail입니다. 각 항목의 ROI 잘라낸 이미지와 신뢰도를 "감지된 숫자" 목록에 함께 보여주어 OCR 결과를 눈으로 검증할 수 있습니다.

ROI 좌표는 Tesseract OCR로 검증했습니다. 4배 확대·대비 보정·반전 전처리 후 11개 항목 모두 사진의 값과 같게 읽혔습니다(1.0, 16.67, 3.0, 118, 436, 436, 436/300, 0.1, 25, MP, STANDBY).

## 실제 연결 지점

- `detectFrame(position, mode, i)` — 지금은 시뮬레이션입니다. 카메라 프레임을 `FIELDS[].roi`로 잘라 OCR 한 결과를 `{ key: { v, conf } }` 형태로 반환하도록 바꾸면 됩니다.
- `FIELDS[].exp` — 모드별 기준값입니다. Normal 모드 기준값은 임시로 MP와 같게 두었으니 실제 규격으로 바꿔 주세요.
- `업로드` 버튼 — 서버 전송은 시뮬레이션입니다. `Excel 내보내기`는 CSV(UTF-8 BOM)를 내려받습니다.

## 파일

- `index.html`, `styles.css`, `app.js` — 단일 페이지 앱
- `assets/device-sample.jpg` — 장비 디스플레이 사진 (1600px)
- `screenshots/` — 화면별 디자인 이미지 (1280px 데스크톱, 390px 모바일)
