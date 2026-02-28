import { NextResponse } from 'next/server'
import { initializeServerRuntime } from './bootstrap.js'

function toQueryObject(url) {
  const query = {}

  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const current = query[key]
      if (Array.isArray(current)) {
        current.push(value)
      } else {
        query[key] = [current, value]
      }
      continue
    }

    query[key] = value
  }

  return query
}

function toCookieMap(request) {
  const cookies = {}
  for (const cookie of request.cookies.getAll()) {
    cookies[cookie.name] = cookie.value
  }
  return cookies
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value ?? '')}`]

  const maxAgeMs = options.maxAge
  if (typeof maxAgeMs === 'number' && Number.isFinite(maxAgeMs)) {
    const seconds = Math.max(0, Math.floor(maxAgeMs / 1000))
    parts.push(`Max-Age=${seconds}`)
    parts.push(`Expires=${new Date(Date.now() + maxAgeMs).toUTCString()}`)
  }

  if (options.expires) {
    parts.push(`Expires=${new Date(options.expires).toUTCString()}`)
  }

  parts.push(`Path=${options.path || '/'}`)

  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')

  const sameSite = options.sameSite
  if (sameSite) {
    const normalized = String(sameSite)
    parts.push(`SameSite=${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`)
  }

  return parts.join('; ')
}

function createResponseState() {
  const state = {
    statusCode: 200,
    body: { success: true },
    isJson: true,
    headers: new Headers(),
    cookies: [],
    sent: false,
  }

  const res = {
    status(code) {
      state.statusCode = Number(code) || 200
      return res
    },

    json(payload) {
      state.body = payload
      state.isJson = true
      state.sent = true
      return res
    },

    send(payload) {
      state.body = payload
      state.isJson = typeof payload === 'object'
      state.sent = true
      return res
    },

    end(payload) {
      if (payload !== undefined) {
        state.body = payload
      }
      state.sent = true
      return res
    },

    cookie(name, value, options = {}) {
      state.cookies.push(serializeCookie(name, value, options))
      return res
    },

    clearCookie(name, options = {}) {
      const clearOptions = {
        ...options,
        expires: new Date(0),
        maxAge: 0,
      }
      state.cookies.push(serializeCookie(name, '', clearOptions))
      return res
    },

    setHeader(name, value) {
      if (Array.isArray(value)) {
        state.headers.delete(name)
        for (const item of value) {
          state.headers.append(name, String(item))
        }
        return res
      }

      state.headers.set(name, String(value))
      return res
    },

    getHeader(name) {
      return state.headers.get(name)
    },

    append(name, value) {
      state.headers.append(name, String(value))
      return res
    },
  }

  return { state, res }
}

function toNextResponse(state) {
  for (const cookie of state.cookies) {
    state.headers.append('set-cookie', cookie)
  }

  if (state.isJson) {
    return NextResponse.json(state.body ?? {}, {
      status: state.statusCode,
      headers: state.headers,
    })
  }

  return new NextResponse(state.body ?? null, {
    status: state.statusCode,
    headers: state.headers,
  })
}

async function runMiddleware(middleware, req, res) {
  return await new Promise((resolve, reject) => {
    let nextCalled = false

    const next = (error) => {
      nextCalled = true
      if (error) {
        reject(error)
        return
      }
      resolve(true)
    }

    Promise.resolve()
      .then(() => middleware(req, res, next))
      .then(() => {
        if (!nextCalled) {
          resolve(false)
        }
      })
      .catch(reject)
  })
}

export async function parseJsonBody(request) {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
    return {}
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return {}
  }

  try {
    return await request.json()
  } catch {
    return {}
  }
}

export function responseJson(status, payload) {
  return NextResponse.json(payload, { status })
}

export async function executeController({
  request,
  controller,
  middlewares = [],
  params = {},
  body = {},
  extra = {},
}) {
  try {
    await initializeServerRuntime()

    const url = new URL(request.url)
    const req = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      query: toQueryObject(url),
      params,
      body,
      cookies: toCookieMap(request),
      ...extra,
    }

    const { state, res } = createResponseState()

    for (const middleware of middlewares) {
      const canContinue = await runMiddleware(middleware, req, res)
      if (!canContinue || state.sent) {
        return toNextResponse(state)
      }
    }

    await Promise.resolve(controller(req, res))

    if (!state.sent) {
      state.statusCode = 204
      state.body = null
      state.isJson = false
      state.sent = true
    }

    return toNextResponse(state)
  } catch (error) {
    console.error('API adapter error:', error)
    return responseJson(500, {
      error: 'Internal server error',
      message: 'Request processing failed',
    })
  }
}
