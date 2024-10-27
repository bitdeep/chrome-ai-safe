let isDev = false
let fd
class SERVICES {
	constructor(_ws_send) {
		this._ws_send = _ws_send
	}
	send(id, data, callback) {
		this._ws_send(id, data, callback)
	}
	async on_page_links(data) {
		this.send('on_page_links', data, this.on_page_links_callback.bind(this))
	}
	async on_page_links_callback(data, res) {
		this.logger('[PAGE-LINKS-CALLBACK]', data.length)
		res(data)
	}
}
class CONNECTOR {
	constructor(fd, services) {
		this.fd = fd
		this.services = services
		this.logger(`[CONNECTOR CONNECT]`, fd.name)
		fd.onMessage.addListener(this.onMessage.bind(this))
		fd.onDisconnect.addListener(this.onDisconnect.bind(this))
	}
	send(data) {
		this.fd.postMessage(data)
	}
	onDisconnect(fd) {
		this.logger(`[CONNECTOR DISCONNECT]`, fd.name)
	}
	onMessage(req) {
		const [id, ___page_callback, data] = req
		if (!this[id]) {
			send({ error: 'NO CALLBACK' })
			this.logger(`[ERROR] NO CALLBACK:`, req)
		} else {
			const args = {
				data,
				___page_callback
			}
			this.logger(`[CALLBACK]`, id)
			this.services[id](args, send)
		}
	}
}
class BACKEND {
	reconnections = 0
	page_callbacks = {}
	async init(self) {
		isDev = self.installType === 'development'
		this.url = isDev ? 'wss://localhost:3000' : 'wss://api.weg.dev.br'
		this.services = new SERVICES(this.send.bind(this))
		this.reconnect()
	}
	onConnect(fd) {
		new CONNECTOR(fd, this.services)
	}

	ws_on_message(event) {
		this.logger(`[WS-RCVD]`, event.data)
		try {
			const [callback_id, page_callback_id, data] = JSON.parse(event.data)
			if (!callback_id) {
				this.logger(`[ERROR]`, 'Invalid message id:', event.data)
			} else {
				const page_callback = this.page_callbacks[page_callback_id]
				if (page_callback) {
					this.logger(`[WS CALLBACK] PAGE FOUND: `, page_callback_id)
					page_callback({ ok: true })
				}
				const callback = this.callbacks[callback_id]
				if (callback) {
					this.logger(`[WS CALLBACK] BY CALLBACK: `, callback_id)
					callback(data, page_callback)
					delete this.callbacks[callback_id]
					delete this.page_callbacks[page_callback_id]
				} else if (this[callback_id]) {
					this.logger(`[WS CALLBACK] BY METHOD: `, callback_id)
					this[callback_id](data, page_callback)
					delete this.callbacks[callback_id]
					delete this.page_callbacks[page_callback_id]
				} else {
					this.logger(`[ERROR]`, 'No callback or page found for callback_id:', callback_id)
				}
			}
		} catch (e) {
			this.logger('[CALLBACK ERROR]')
			this.logger('data', event.data)
			this.logger(e)
		}
	}
	reconnect() {
		if (fd) {
			fd.close()
			fd = undefined
		}
		this.logger(`[RECONNECT]`, this.url)
		fd = new WebSocket(this.url)
		fd.onopen = this.ws_on_open.bind(this)
		fd.onmessage = this.ws_on_message.bind(this)
		fd.onclose = this.ws_on_close.bind(this)
		fd.onerror = this.ws_on_error.bind(this)
	}
	ws_on_open() {
		this.send('app_background_init', { isDev })
		++this.reconnections
		// if reconnecting, send message to reload content:
		if (this.reconnections > 1) {
			this.logger(`[OPEN]`, this.url)
			this.page_send('background_reload', {})
		} else {
			//
			this.logger(`[RECONNECT]`, this.url, this.reconnections)
		}
	}
	ws_on_close() {
		this.logger(`[CLOSE] Reconnecting 2s...`)
		setTimeout(this.reconnect.bind(this), 2000)
	}
	ws_on_error(error) {
		this.logger(`[SOCKET-ERROR]`, error)
		setTimeout(this.reconnect.bind(this), 2000)
	}
	logger(type, ...args) {
		console.log(type, ...args)
		this.logger(`[BACKEND/this.logger]`, type, ...args)
	}
	dev_update_callback(data) {
		this.logger(`[DEV UPDATE]`, data)
		chrome.tabs.query({ currentWindow: true }, tabs => {
			if (tabs.length > 0) {
				chrome.tabs.reload(tabs[0].id)
				chrome.runtime.reload()
				console.clear()
				this.logger(`[RELOADED]`, tabs[0].id)
			} else {
				this.logger(`[ERROR]`, 'No tabs found')
			}
		})
	}
	page_send(id, data) {
		const r = { id, data }
		chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
			if (tabs.length > 0) {
				this.logger(`[PAGE-SEND]`, tabs[0].id, r)
				chrome.tabs.sendMessage(tabs[0].id, r)
			} else {
				this.logger(`[PAGE-SEND ERROR]`, 'No tabs found')
				console.trace()
			}
		})
	}
	callback_index = 0
	callbacks = {}
	send(id, data, callback) {
		const callback_id = ++this.callback_index
		this.callbacks[callback_id] = callback
		const r = [isDev, callback_id, id, data]
		this.logger(`[WS-SEND]`, r)
		if (fd && (fd.readyState === WebSocket.CLOSING || fd.readyState === WebSocket.CLOSED)) {
			this.logger('[WS-SEND ERROR]', 'WebSocket is already in CLOSING or CLOSED state.')
		} else if (fd) {
			fd.send(JSON.stringify(r))
		} else {
			this.logger(`[WS-SEND ERROR]`, 'WebSocket is not open.')
		}
	}
	onRunTimeMessage(request, sender, sendResponse) {
		if (request.action === 'openDevTools') {
			chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
				if (tabs.length > 0) {
					this.logger('[OPEN-DEV-TOOLS]', tabs[0].id)
					chrome.tabs.sendMessage(tabs[0].id, { action: 'openDevTools' })
				} else {
					this.logger('[OPEN-DEV-TOOLS ERROR]', 'No tabs found')
				}
			})
		} else {
			this.logger('[ERROR - RCVD BACKGROUND MESSAGE ERROR - NO CALLBACK]', request)
		}
	}
	logger(type, ...args) {
		let line = new Error().stack.split('\n')[3]
		const urlRX = /chrome-extension:\/\/([^\/]+)\//
		line = line.replace(urlRX, '')
		const fileRX = /at .+ \((.+):(\d+):\d+\)/
		const match = line.match(fileRX)
		const file = match ? `extension/${match[1]}:${match[2]}` : ''
		const strlog = args
			.map(arg => {
				if (typeof arg === 'object') {
					return JSON.stringify(arg)
				} else {
					return arg
				}
			})
			.join(', ')
		const str = `${type} ${strlog} ${file}`
		console.log(str)
	}
}

const backend = new BACKEND()
chrome.runtime.onConnect.addListener(backend.onConnect.bind(backend))
chrome.runtime.onMessage.addListener(backend.onRunTimeMessage.bind(backend))
chrome.management.getSelf(backend.init.bind(backend))
