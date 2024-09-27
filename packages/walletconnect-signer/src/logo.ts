// note: there should be a circle here as well, but it doesn't blend well with the established design
// <circle cx="175" cy="175" r="175" fill="#0888f0" transform="matrix(-1 0 0 1 350 0)"></circle>
const LOGO_DATA_URL = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 350 350">
  <path fill="#fff" d="m229.916 160.179 20.601-20.474c-46.561-46.274-104.416-46.274-150.977 0l20.601 20.474c35.411-35.193 74.388-35.193 109.799 0h-.024Z"></path>
  <path fill="#fff" d="m223.045 207.88-48.044-47.748-48.045 47.748-48.045-47.748-20.577 20.45 68.622 68.222 48.045-47.748 48.044 47.748 68.622-68.222-20.577-20.45-48.045 47.748Z"></path>
</svg>
`);
export default LOGO_DATA_URL;