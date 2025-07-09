export class SQLDb {
	baseurl;
	constructor(baseurl) {
		this.baseurl = baseurl
	}
	async run(query) {
		const url = new URL(this.baseurl, window.location.origin);
		url.searchParams.append('query', query);
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		})
		var res_obj = await res.json()
		//console.log(res_obj)
		// convert to key-value
		var ret = []
		for (var r=0; r<res_obj[0].values.length; r++) {
			var row = {}
			for (var c=0; c<res_obj[0].columns.length; c++) {
				row[res_obj[0].columns[c]] = res_obj[0].values[r][c]
			}
			ret.push(row)
		}
		//console.log(ret)
		console.log(`SQLDb returned ${ret.length} results.`)
		return ret
	}
}

export class WebCogsCore {

	routeCallback = null;
	loadedPlugins = {};
	db = null;

	constructor(routeCallback,db) {
		this.db = db;
		this.routeCallback = routeCallback;
	}

    /**
     * Mounts the supplied HTML and CSS code into a Shadow DOM attached to the given element.
     * @param {string} location - The id of the target HTML element.
     * @param {string} html_code - The HTML code to be rendered inside the Shadow DOM.
     * @param {string} css_code - The CSS code to be applied within the Shadow DOM.
	 * @return {htmlElement} - the shadow root
     */
	mount(location, html_code, css_code) {
        const host = document.getElementById(location);
        if (!host) return;
		// purge any old shadow root and any event listeners by cloning host node
		const newHost = host.cloneNode(false);
  		host.replaceWith(newHost);
        const shadow = /*host.shadowRoot ||*/ newHost.attachShadow({ mode: 'open' });
        shadow.innerHTML = '';
        if (css_code) {
            const style = document.createElement('style');
            style.textContent = css_code;
            shadow.appendChild(style);
		}
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html_code;
        shadow.appendChild(wrapper);
		return shadow;
    }

	route(location,...params) {
		this.routeCallback(location,...params)
	}

	async loadPlugin(path, name) {
		try {
			//console.log(`Loading plugin ${name}...`)
			const module = await import(path)
			var loadedSyms = 0
			for (const key in module) {
				if (typeof this.loadedPlugins[name] != "undefined") {
					console.error(`Plugin named ${name} already loaded.`)
					return;
				}
				console.log(`Loaded plugin ${name}.`)
				console.log(module[key])
				this.loadedPlugins[name] = module[key]
				loadedSyms += 1
			}
			if (loadedSyms != 1) {
				console.error(`Unexpected number of symbols in plugin ${name}: ${loadedSyms}`)
			}
        } catch (error) {
            console.error('Failed to load plugin:', error)
        }
	}

	initPlugin(name,...args) {
		if (this.loadedPlugins[name]) {
			var instance = new this.loadedPlugins[name](this,...args)
			console.log(instance)
		} else {
			console.error(`Cannot find plugin ${name}`)
		}
	}

}