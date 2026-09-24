document.addEventListener("DOMContentLoaded", () => {
  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();

  // Keep the storefront header consistent across every page.
  // The Account icon opens the account page. If the user is not authenticated,
  // auth-guard.js on that page redirects them to Login.
  const accountLinks = document.querySelectorAll('.header-actions a[href*="login"], .header-actions a[href*="auth"]');
  const cartLinks = document.querySelectorAll('.header-actions a[href*="cart"]');

  const accountIcon = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5"></circle>
      <path d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5"></path>
    </svg>`;

  const cartIcon = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h2l1.5 10h9.8L20 8H7"></path>
      <circle cx="9" cy="19" r="1"></circle>
      <circle cx="17" cy="19" r="1"></circle>
    </svg>`;

  accountLinks.forEach((link) => {
    if (!link.querySelector(".icon")) link.insertAdjacentHTML("afterbegin", accountIcon);
    link.classList.add("icon-link");

    // Public pages used to point Account directly to Login. That made an
    // authenticated user appear logged out when returning from Shop.
    // Always open the protected account page instead.
    const accountPath = window.location.pathname.includes("/pages/")
      ? "../account/profile.html"
      : "account/profile.html";
    link.setAttribute("href", accountPath);
  });

  cartLinks.forEach((link) => {
    if (!link.querySelector(".icon")) link.insertAdjacentHTML("afterbegin", cartIcon);
    link.classList.add("icon-link");
  });
});
