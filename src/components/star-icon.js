export function renderStarIcon() {
  return `
    <svg width="0" height="0" style="position:absolute">
      <symbol id="star" viewBox="0 0 24 24">
        <path d="M12 2C12.6 7.5 16.5 11.4 22 12C16.5 12.6 12.6 16.5 12 22C11.4 16.5 7.5 12.6 2 12C7.5 11.4 11.4 7.5 12 2Z"/>
      </symbol>
    </svg>
  `;
}

export function createStar() {
  return `<svg class="star" aria-hidden="true"><use href="#star"/></svg>`;
}
