# Design direction

The Phase 1 interface follows the approved **Architectural Capital** direction: architectural minimalism (60%), contemporary investment firm (25%), and modern Australian developer (15%). The visual system uses charcoal, warm white, restrained borders, editorial type scale, and generous whitespace. It avoids generic sales-agency and colourful SaaS patterns.

`#121316` is the primary ink; `#F8F8F6` is the main background; `#F1F0EC` is a subtle surface; `#EBE8E1` defines borders. The system is responsive and maintains visible keyboard focus through browser defaults.

The current corporate photography is sourced from Unsplash as temporary design imagery. It must be replaced with approved, licensed images before production.

## Unified Portal — Phase 3B

All business workflows must remain inside the unified Grand Harmony Portal. The sidebar must be collapsible, and complex models must support an immersive Focus Mode without opening new browser windows.

The shared Portal layout owns navigation and uses a charcoal sidebar with accessible icon labels/tooltips. Collapse state is persisted in browser storage. Focus Mode changes layout in place without unmounting the model; the model toolbar and an exit control remain reachable. Small screens use a narrow navigation rail. Model canvases use the remaining width, and the HTML adapter reports document height to avoid competing vertical scrollbars. Print layouts hide all Portal navigation and editing controls.

## Phase 3C — quiet Portal-native standard

Portal is premium, minimal and predominantly warm white, with charcoal text, very light grey/stone borders and restrained beige emphasis. Modern sans-serif remains the default for forms, tables and UI; editorial Georgia headings add a quiet classical quality. Abstract thin curved lines appear only as low-contrast header details. Do not use ink landscapes, calligraphy, seals, bamboo, fans, dragons, decorative cultural illustrations or large red/gold areas.

The corporate website retains its existing direction. Portal Library and Project Overview use considered whitespace, understated cards, neutral active states and compact controls. Model Runner uses the available workspace width without a max-width cap. Its reusable Model Shell includes project context, a stable scenario toolbar, workspace/scenario/history tabs, model section navigation, native inputs/results/charts and a right-side quick summary. Collapsed Sidebar and in-place Focus Mode retain the mounted model and improve available width.

**Import the model logic, not the old model page design.** Future models should preserve business logic and data structure, but should not preserve legacy standalone page design unless absolutely necessary. Portal components own branding, headings, fonts, colours, controls and layout. A controlled iframe is a temporary bridge only: strip legacy branding, redundant headers/navigation and conflicting save controls, then place it inside the same Portal Shell.

## Phase 4A — corporate website and content controls

The public website uses a contemporary Australian architectural direction: charcoal `#121316`, warm white `#F8F8F6`, pure white, soft stone `#F1F0EC`, muted bronze slate `#6E6A5F` and subtle `#EBE8E1` borders. Editorial serif display headings sit alongside clear modern sans-serif body/UI typography. The visual system is quiet, spacious and professional, with only abstract thin circular/ink-wash-like washes; it must never use literal Chinese ornaments, calligraphy, bright red or decorative motifs.

The hero is a cinematic responsive media region with controlled image/video mode, poster URL, alignment and overlay presets. Video must be muted, looped, `playsInline`, include a poster and respect reduced-motion preferences. The currently configured architectural Unsplash image is temporary design imagery and must be replaced with owner-approved licensed media through Website Management before final branding approval.

Website Management deliberately uses structured fields rather than unrestricted HTML/CSS or a page builder. This protects the typography, layout, accessibility and brand. Public cards render only explicitly published Team and Development entries; an empty state remains intentionally complete and does not invent people or projects.
