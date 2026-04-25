const routes = []

export function addRoute(pattern, loader) {
  // Convert path pattern like "/recipe/:id" to a named-group regex
  const re = new RegExp(
    '^' + pattern.replace(/:([^/]+)/g, '(?<$1>[^/]+)') + '/?$'
  )
  routes.push({ re, loader })
}

async function resolve(path) {
  for (const { re, loader } of routes) {
    const match = path.match(re)
    if (match) {
      const params = match.groups ?? {}
      const mod = await loader()
      return { render: mod.default, params }
    }
  }
  return null
}

async function navigate(path) {
  const app = document.getElementById('app')
  const route = await resolve(path)
  const newHtml = route ? route.render(route.params) : '<h1>404 — Page not found</h1>'

  // Exit animation (skip on initial load when app is empty)
  if (app.innerHTML.trim()) {
    app.classList.add('page-exit')
    await new Promise(r => setTimeout(r, 300))
  }

  // Swap content with transition disabled so enter state is set instantly
  app.style.transition = 'none'
  app.innerHTML = newHtml
  app.classList.remove('page-exit')
  app.classList.add('page-enter')
  app.offsetHeight // force reflow
  app.style.transition = ''
  app.classList.remove('page-enter')
}

export function initRouter() {
  // Intercept <a> clicks for same-origin links
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]')
    if (!anchor) return
    const url = new URL(anchor.href, location.origin)
    if (url.origin !== location.origin) return
    e.preventDefault()
    history.pushState(null, '', url.pathname)
    navigate(url.pathname)
  })

  window.addEventListener('popstate', () => navigate(location.pathname))

  navigate(location.pathname)
}
