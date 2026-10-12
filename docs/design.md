# Design direction

The Phase 1 interface follows the approved **Architectural Capital** direction: architectural minimalism (60%), contemporary investment firm (25%), and modern Australian developer (15%). The visual system uses charcoal, warm white, restrained borders, editorial type scale, and generous whitespace. It avoids generic sales-agency and colourful SaaS patterns.

`#121316` is the primary ink; `#F8F8F6` is the main background; `#F1F0EC` is a subtle surface; `#EBE8E1` defines borders. The system is responsive and maintains visible keyboard focus through browser defaults.

The current corporate photography is sourced from Unsplash as temporary design imagery. It must be replaced with approved, licensed images before production.

## Unified Portal — Phase 3B

All business workflows must remain inside the unified Grand Harmony Portal. The sidebar must be collapsible, and complex models must support an immersive Focus Mode without opening new browser windows.

The shared Portal layout owns navigation and uses a charcoal sidebar with accessible icon labels/tooltips. Collapse state is persisted in browser storage. Focus Mode changes layout in place without unmounting the model; the model toolbar and an exit control remain reachable. Small screens use a narrow navigation rail. Model canvases use the remaining width, and the HTML adapter reports document height to avoid competing vertical scrollbars. Print layouts hide all Portal navigation and editing controls.
