# Magic UI

Source: https://github.com/magicuidesign/magicui

Pinned revision: `efe76fc5755eca1142dd4f74c1d6f0ace2887e3c`.

These are the official open-source component implementations, installed manually from the repository and customized through props and application adapters. Original source hashes and URLs are recorded in provenance.json. The MIT license is retained in LICENSE.md and public/licenses/magicui.txt.

Local adaptations:

- Magic Card imports the converter's theme adapter instead of next-themes. Theme state and persistence stay with the existing application.
- Animated Theme Toggler skips the View Transitions animation when reduced motion is requested.
- App wrappers pause decorative beams off screen/in background tabs and disable motion for reduced-motion users. Button and card colors use the existing red and neutral palette.
- The application provider observes reduced-motion preference changes live, rather than relying on the motion library's mount-time preference snapshot.

Tailwind's utilities are included without its global preflight reset to keep native forms and existing page semantics intact. Required animation keyframes come from the official component registry.

Current lightweight motion profile: the app uses Animated Beam for the small hero connector and Border Beam for active drag feedback. Page-wide Blur Fade, Shimmer Button, Ripple Button, pointer-tracking Magic Card, and the Animated Theme Toggler are no longer mounted by application adapters. Their pinned source files remain for provenance and licensing. Controls use native buttons with brief CSS feedback, card surfaces are static, and page changes remain opaque.
