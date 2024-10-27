class PageLink {
	aiSession = null
	statusText = null
	toolbar = null
	progress = null
	progressBar = null
	closeBtn = null
	constructor() {}
	async start() {
		//this.on_page_links()
		if (this.checkAIAvailability()) {
			this.toolbar = this.injectToolbar()
			const content = document.body.innerText
			const result = await this.analyzeSafety(content)
			if (result.error) {
				this.danger(result.message)
				return
			}
			let message = ''
			const { avg, scores, sentiment } = result
			const scores_message = []
			for (let i = 0; i < scores.length; i++) {
				for (let j = 0; j < scores[i].length; j++) {
					const s = scores[i][j]
					if (s[1] > 0) {
						scores_message.push(`${s[0]}: ${s[1]}%`)
					}
				}
			}
			message += ` <b>${sentiment.toUpperCase()}</b>: `
			message += scores_message.join(', ')
			this.toolbar.style.display = 'flex'
			this.toolbar.innerHTML = `
			<div style="flex: 1">
				${message}
			</div>
			<div style="font-weight: bold; margin-left: 20px">
				<b>Safety:</b> ${avg.toFixed(1)}%
			</div>
			<button style="background: none; border: none; color: white; cursor: pointer; padding: 0 10px; font-size: 1.2em;" onclick="this.parentElement.style.display='none'">×</button>
		`
			setTimeout(() => {
				this.toolbar.style.display = 'none'
			}, 15000)
		} else {
			this.danger('[ERROR - AI NOT AVAILABLE]')
		}
	}
	get_all_links() {
		const links = Array.from(document.getElementsByTagName('a'))
		const on_page_links = links.map(link => ({
			title: link.textContent?.trim() || '',
			href: link.href,
			link: link
		}))
		return on_page_links
	}
	chunk(text, start, chunkSize) {
		if (text.length - start <= chunkSize) {
			return text.slice(start)
		}
		const searchRange = Math.min(text.length - start, chunkSize + 100)
		let slicePoint = chunkSize
		const htmlTagMatch = text.slice(start + chunkSize, start + searchRange).match(/<\/[^>]+>/)
		if (htmlTagMatch) {
			slicePoint = chunkSize + htmlTagMatch.index + htmlTagMatch[0].length
		} else {
			const punctuationMatch = text.slice(start + chunkSize, start + searchRange).match(/[.;!?\n。，,：:'"』」》）\]）\}\s]/)
			if (punctuationMatch) {
				slicePoint = chunkSize + punctuationMatch.index + 1
			}
		}
		return text.slice(start, start + slicePoint)
	}
	injectToolbar() {
		this.toolbar = document.createElement('div')
		this.toolbar.id = 'ai-safety-toolbar'
		this.toolbar.style.cssText = `
			position: fixed;
			width: 95%;
			background: linear-gradient(90deg, rgba(74, 144, 226, 0.5), rgba(144, 19, 254, 0.5));
			color: #FFFFFF;
			padding: 5px 5px;
			font-size: 0.8em;
			z-index: 1000000;
			display: none;
			align-items: center;
			justify-content: space-between;
			font-family: Verdana, Arial, sans-serif;
			box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
			border-radius: 8px;
		`

		const style = document.createElement('style')
		style.textContent = `
			.status-info {
				color: #E0F7FA;
				background-color: rgba(64, 156, 255, 0.2);
				padding: 4px 8px;
				border-radius: 4px;
			}
			.status-success {
				color: #C8E6C9;
				background-color: rgba(76, 175, 80, 0.2);
				padding: 4px 8px;
				border-radius: 4px;
			}
			.status-warning {
				color: #FFF9C4;
				background-color: rgba(255, 235, 59, 0.2);
				padding: 4px 8px;
				border-radius: 4px;
			}
			.status-danger {
				color: #FFCDD2;
				background-color: rgba(244, 67, 54, 0.2);
				padding: 4px 8px;
				border-radius: 4px;
			}
		`
		document.head.appendChild(style)

		this.statusText = document.createElement('div')
		this.statusText.id = 'ai-safety-status'
		this.statusText.textContent = ''

		this.progress = document.createElement('div')
		this.progress.id = 'ai-safety-progress'
		this.progress.style.cssText = `
			width: 200px;
			height: 4px;
			background: rgba(255,255,255,0.2);
			border-radius: 2px;
			overflow: hidden;
		`

		this.progressBar = document.createElement('div')
		this.progressBar.style.cssText = `
			width: 0%;
			height: 100%;
			background: #2196F3;
			transition: width 0.3s;
		`
		this.progress.appendChild(this.progressBar)

		this.closeBtn = document.createElement('button')
		this.closeBtn.textContent = '×'
		this.closeBtn.style.cssText = `
			background: none;
			border: none;
			color: white;
			font-size: 20px;
			cursor: pointer;
			padding: 0 8px;
		`
		this.closeBtn.onclick = () => this.toolbar.remove()
		this.toolbar.appendChild(this.statusText)
		this.toolbar.appendChild(this.progress)
		this.toolbar.appendChild(this.closeBtn)
		document.body.insertBefore(this.toolbar, document.body.firstChild)
	}
	updateStatus(text, type = 'info') {
		if (!this.toolbar) this.injectToolbar()
		//console.log(`[UPDATE STATUS - ${type.toUpperCase()}]`, text)
		this.statusText.textContent = text
		this.statusText.classList.remove('status-info', 'status-success', 'status-warning', 'status-danger')
		this.statusText.classList.add(`status-${type}`)
		this.toolbar.style.display = 'flex'
	}
	updateProgress(percent) {
		this.progressBar.style.width = `${percent}%`
	}
	remove() {
		console.log('[remove]')
		this.toolbar.remove()
	}
	removeAfter(ms) {
		console.log('[removeAfter]', ms)
		setTimeout(() => {
			this.remove()
		}, ms)
	}
	async analyzeSafety(content) {
		const maxSize = 1000
		const chunks = []
		for (let i = 0; i < content.length; i += maxSize) {
			chunks.push(this.chunk(content, i, maxSize))
		}
		let totalSafetyScore = 0
		const analysisResults = []

		const totalChunks = chunks.length
		let validChunks = 0
		for (let i = 0; i < chunks.length; i++) {
			const chunkNumber = i + 1
			const prompt = `
<INSTRUCTIONS>
${this.systemPrompt}
</INSTRUCTIONS>
<START OF CONTENT>
${chunks[i]}
<END OF CONTENT>
<RESPONSE FORMAT>
Please return ONLY valid JSON in the exact schema shown. 
Do not include any other text or explanation. 
The response must be parseable by JSON.parse().
</RESPONSE FORMAT>
`
			this.info(`Analyzing ${chunkNumber} of ${totalChunks}...`)
			this.updateProgress(Math.round(((chunkNumber - 1) / totalChunks) * 100))
			const result = await this.ml(prompt)
			if (result.error) {
				return { error: true, message: result.message }
			}

			analysisResults.push(result)
			this.updateProgress(Math.round((chunkNumber / totalChunks) * 100))
		}
		console.log('[ANALYSIS RESULTS]', analysisResults)
		let content_types = []
		for (let i = 0; i < analysisResults.length; i++) {
			const result = analysisResults[i]
			for (let j = 0; j < result.length; j++) {
				const s = result[j]
				if (s[1] > 0) {
					totalSafetyScore += s[1]
					validChunks++
					content_types.push(`${s[0]}=${s[1]}`)
				}
			}
		}
		if (content_types.length === 0) {
			content_types.push('neutral=100')
		}
		const sentimentPrompt = `
<INSTRUCTIONS>
Analyze these sentiment results and provide a final overall sentiment assessment.
</INSTRUCTIONS>
<CONTENT TYPES>
${content_types.join(', ')}
</CONTENT TYPES>
<RESPONSE FORMAT instruction="Return a JSON object with one of the following values:">
{sentiment: "neutral" | "toxic" | "positive" | "negative"}
</RESPONSE FORMAT>`
		//console.log('[SENTIMENT PROMPT]', sentimentPrompt)
		const finalSentiment = await this.ml(sentimentPrompt)
		//console.log('[FINAL SENTIMENT]', finalSentiment)
		const averageSafetyScore = totalSafetyScore / validChunks
		this.updateProgress(95)
		return {
			sentiment: finalSentiment.sentiment,
			avg: averageSafetyScore,
			scores: analysisResults
		}
	}
	systemPrompt = `
Analyze this webpage content and give a safety percentage score from 0-100%. 
Consider: Adult, Gambling, Violent, Hateful, Deceptive, Spammy, Malware, Sentiment.
The value 0-100% represents the percentage of the content in the page that is of the type.
Suggest any other categories that are relevant, like: "Sexual, Drugs, etc."
Return example: 
[["adult", 0-100], ...]
`
	async ml(prompt) {
		if (!this.session) {
			this.session = await ai.languageModel.create()
		}
		const promptHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt)).then(hash =>
			Array.from(new Uint8Array(hash))
				.map(b => b.toString(16).padStart(2, '0'))
				.join('')
		)
		const cachedResponse = await chrome.storage.local.get(promptHash)
		if (cachedResponse[promptHash]) {
			const result = JSON.parse(cachedResponse[promptHash])
			//const size = cachedResponse.length
			//const humanSize = size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`
			//console.log(`[ML CACHE HIT] Size: ${humanSize}`)
			return result
		}
		//const startTime = performance.now()
		let response
		//console.log('[ML PROMPT]', prompt.length)
		try {
			response = await this.session.prompt(prompt)
			//console.log('[ML RESPONSE]', response)
			// const duration = performance.now() - startTime
			// const size = response.length
			//const humanSize = size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`
			//console.log(`[ML CACHE MISS] Duration: ${duration.toFixed()}ms, Size: ${humanSize}`)
			await chrome.storage.local.set({ [promptHash]: response })
			//const numTokens = await this.session.countPromptTokens(prompt)
			//console.log(`${this.session.tokensSoFar}/${this.session.maxTokens} (${this.session.tokensLeft} left), ${numTokens} tokens`)
			return JSON.parse(response)
		} catch (error) {
			console.log('[ML ERROR]', error)
			this.danger('[ML ERROR] ' + error.message)
			return { error: true, message: error.message }
		}
	}
	async checkAIAvailability() {
		if (!window.ai) {
			const warningDiv = document.createElement('div')
			warningDiv.style.cssText = `
				position: fixed;
				top: 20px;
				left: 50%;
				transform: translateX(-50%);
				background-color: #ff0000;
				color: white;
				padding: 20px;
				border-radius: 8px;
				box-shadow: 0 4px 8px rgba(0,0,0,0.2);
				z-index: 999999;
				font-size: 16px;
				font-weight: bold;
				text-align: center;
			`
			warningDiv.textContent = 'Warning: Window AI API is not available. Please install the Window AI extension'
			document.body.appendChild(warningDiv)
			return false
		}
		return true
	}

	// Add new methods for different message types
	info(message) {
		this.updateStatus(message, 'info')
	}

	success(message) {
		this.updateStatus(message, 'success')
	}

	warning(message) {
		this.updateStatus(message, 'warning')
	}

	danger(message) {
		this.updateStatus(message, 'danger')
	}
}

new PageLink().start()
