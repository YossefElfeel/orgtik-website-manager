# Commerce header consistency

Compared the cart and checkout header against the existing Contact page header. The desktop logo, navigation pill dimensions and position, language control, Sign in link, contact action, colors, border, shadow, and translucent background now match. Commerce routes share `SiteHeader.jsx` through `CommerceLayout`.

Verified cart and checkout at 1440px, the 1180px desktop boundary, and compact layouts at 320, 390, and 768px. No horizontal overflow was observed. The full-screen menu supports keyboard looping, Escape, restored trigger focus, background scroll locking, and all navigation destinations. Language options open and dismiss normally; the fixed header stays at 14px during scrolling. Cart configuration was preserved. Browser console reported no errors.

Formatting and production build passed. Screenshots capture the updated cart, checkout, and mobile navigation menu.
