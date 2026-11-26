# LUNARA design system

The mobile refresh follows the supplied rose editorial reference and uses locally served LUNARA artwork. Literata is used on Welcome, editorial and featured article headings, and the large cycle and report numbers. Be Vietnam Pro is used for in-app headings, copy, calendar, dates, buttons, and tab labels.

Both families are bundled as Latin WOFF2 files in `public/assets/fonts/`. Literata keeps variable weight and optical size. Be Vietnam Pro uses 400, 600 and 700. The first body weight is preloaded and the other faces load when used, with system fallbacks during font loading. Font licenses are included as `OFL-Literata.txt` and `OFL-BeVietnamPro.txt`. [Literata source](https://github.com/google/fonts/tree/main/ofl/literata) · [Be Vietnam Pro source](https://github.com/google/fonts/tree/main/ofl/bevietnampro)

| Token | Value | Role |
| --- | --- | --- |
| Canvas | `#fff3f7` | Main background |
| Paper | `#ffffff` | Form controls |
| Surface | `#fffbfd` | Cards |
| Ink | `#381a31` | Headlines and body |
| Subtle | `#674a5e` | Supporting copy |
| Mauve | `#98345e` | Primary interactive color |
| Rose | `#df6e9f` | Cycle dial accent |
| Blush | `#f7b9d4` | Cycle dial track |
| Lavender | `#efdff5` | Secondary visual accent |

- Welcome uses the local portrait at full bleed on mobile and beside the headline on larger displays. The mobile footer places sign-in and onboarding within thumb reach.
- The shell keeps five primary destinations in a fixed bottom bar with safe-area padding. Desktop uses a rail with additional library and report links.
- Inputs and prominent controls have 44-pixel minimum heights. Focus states use a visible mauve outline, and dialog acknowledgement is available through Escape or the close control.
- Decorative imagery uses empty alt text. Descriptive image text comes from the Phase 03 catalog.
- Calendar entries distinguish logged dates, the current day and estimated start windows. The Home dial displays the elapsed day since the latest recorded start. Insights charts and the report count use saved entries.
