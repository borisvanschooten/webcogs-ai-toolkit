export class SQLDb {
	baseurl;
	token=null;
	lastError=null;
	constructor(baseurl) {
		this.baseurl = baseurl
	}
	async run(query,interpolation_params) {
		const url = new URL(this.baseurl, window.location.origin);
		url.searchParams.append('query', query);
		url.searchParams.append('token', this.token);
		if (interpolation_params) {
			url.searchParams.append('params',JSON.stringify(interpolation_params))
		}
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		})
		var res_obj = await res.json()
		if (typeof res_obj.error != "undefined") {
			this.setToken(null)
			this.lastError = "Invalid access"
			throw new Error("Invalid access")
		}
		if (res_obj.length == 0) return null
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
	setToken(token) {
		this.token = token
		this.lastError = null
	}
}

export class WebCogsCore {

	routeCallback = null;
	mountCallback = null;
	loadedPlugins = {};
	db = null;

	constructor(routeCallback,mountCallback,db) {
		this.db = db;
		this.routeCallback = routeCallback;
		this.mountCallback = mountCallback;
	}

    /** Widget mount function for plugins.  Default implementation is to mount a shadow DOM on the elementID given by location.
     * @param {string} location - A location string
     * @param {string} html_code - The HTML code to be rendered
     * @param {string} css_code - The CSS code to be applied
	 * @return {htmlElement} - the root element on which the widget was mounted
     */
	mount(location, html_code, css_code) {
		if (this.mountCallback) {
			return this.mountCallback(location,html_code,css_code)
		} else {
			return this.mountShadowDom(location,html_code,css_code)
		}
	}

    /** Mounts the supplied HTML and CSS code into a Shadow DOM attached to the given element.
     * @param {string} location - The id of the target HTML element.
     * @param {string} html_code - The HTML code to be rendered inside the Shadow DOM.
     * @param {string} css_code - The CSS code to be applied within the Shadow DOM.
	 * @return {htmlElement} - the shadow root
     */
	mountShadowDom(location, html_code, css_code) {
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

	/** Route function for plugins. Default implementation is to invoke the plugin named "location".
	 * @param {string} location - string that indicates where to route to
	 */
	route(location,...params) {
		if (this.routeCallback) {
			this.routeCallback(location,...params)
		} else {
			this.initPlugin(route, ...params)
		}
	}

	/** Load plugin from JS file
	 * @param {string} path - location of JS file
	 * @param {string} name - name to give to the plugin
	 */
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

    /** Load multiple plugins from a manifest JSON file.
     * @param {string} manifest_path - Path to the manifest JSON file.
     */
    async loadPlugins(app_basedir,manifest_path) {
        try {
            const res = await fetch(manifest_path);
            if (!res.ok) {
                throw new Error(`Failed to load manifest: ${res.statusText}`);
            }

            const manifest = await res.json();
            const { wd, targets } = manifest;

            if (Array.isArray(targets)) {
                for (const target of targets) {
                    const { file, name } = target;
					// XXX absolute path will only work if manifest is read from the same root as the web server
					const fullpath = `${app_basedir}/${wd}${file}`
					console.log(fullpath)
                    await this.loadPlugin(fullpath, name);
                }
            } else {
                console.error("Manifest targets should be an array.");
            }
        } catch (error) {
            console.error('Error loading plugins from manifest:', error);
        }
    }
	
	/** Init a previously loaded plugin. Constructs the class; passes any custom arguments on to the class constructor.
	 * @param {string} name - the name given to the plugin at load time
	 * @return {object} - the created instance, or null on failure
	 */
	initPlugin(name,...args) {
		if (this.loadedPlugins[name]) {
			return new this.loadedPlugins[name](this,...args)
		} else {
			console.error(`Cannot find plugin ${name}`)
			return null
		}
	}

    /** Authenticates a user by username and password, retrieves a token upon success.
     * @param {string} username - The username for authentication.
     * @param {string} password - The password for authentication.
     * @return {Promise<string>} - A promise that resolves to the token if authentication is successful.
     */
    async login(username, password) {
        try {
            const url = new URL('auth/login', window.location.origin);
            url.searchParams.append('username', username);
            url.searchParams.append('password', password);

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                throw new Error(`Failed to authenticate: ${res.statusText}`);
            }

            const res_obj = await res.json();
            if (res_obj.token) {
                return res_obj.token;
            } else {
                throw new Error('Authentication failed: No token received');
            }
        } catch (error) {
            console.error('Error during authentication:', error);
            return null;
        }
    }

}