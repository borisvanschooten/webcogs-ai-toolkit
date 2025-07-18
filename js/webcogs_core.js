export class SQLDb {
	baseurl;
	lastError=null;
	authCookieName=null;
	constructor(baseurl,authCookieName) {
		this.baseurl = baseurl
		this.authCookieName = authCookieName
	}
	convertRecordsToKeyValue(records) {
		var ret = []
		for (var r=0; r<records.values.length; r++) {
			var row = {}
			for (var c=0; c<records.columns.length; c++) {
				row[records.columns[c]] = records.values[r][c]
			}
			ret.push(row)
		}
		return ret
	}
	async run(query,interpolation_params) {
		const getCookie = n => (document.cookie.split('; ').find(row => row.startsWith(n + '=')) || '').split('=')[1] || null;
		const url = new URL(this.baseurl, window.location.origin);
		url.searchParams.append('query', query);
		url.searchParams.append('token', getCookie(this.authCookieName));
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
			console.log("Database reports error: "+res_obj.error)
			this.lastError = "Invalid access"
			throw new Error("Invalid access")
		}
		if (res_obj.length == 0) return []
		const ret = this.convertRecordsToKeyValue(res_obj[0])
		//console.log(ret)
		console.log(`SQLDb returned ${ret.length} results.`)
		return ret
	}
}

export class WebCogsCore {

	routeCallback = null;
	mountCallback = null;
	baseStyleUrl = null;
	translations = null;
	loadedPlugins = {};
	db = null;

	constructor(routeCallback,mountCallback,baseStyleUrl,db) {
		this.db = db;
		this.routeCallback = routeCallback;
		this.mountCallback = mountCallback;
		this.baseStyleUrl = baseStyleUrl;
	}

	async loadTranslations(translationsFile) {
		if (!translationsFile) {
			this.translations = null;
			return;
		}
		// NOTE: is asynchronous
		var response = await fetch(translationsFile)
		var data = await response.json()
		console.log(data)
		this.translations = data.reduce((acc, { source, translation }) => {
			acc[source] = translation;
			return acc;
		}, {});
		console.log(this.translations)
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
        const shadow = /*host.shadowRoot ||*/ newHost.attachShadow({ mode: 'open' });
        //shadow.innerHTML = '';
		if (this.baseStyleUrl) {
			const baseLink = document.createElement('link');
			baseLink.setAttribute('rel', 'stylesheet');
			baseLink.setAttribute('href', this.baseStyleUrl);
			shadow.appendChild(baseLink);
		}
        if (css_code) {
            const style = document.createElement('style');
            style.textContent = css_code;
            shadow.appendChild(style);
		}
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html_code;
        shadow.appendChild(wrapper);
  		host.replaceWith(newHost);
		return shadow;
    }
	
    /** Unmounts the content within the Shadow DOM attached to the given element, effectively clearing it.
     * @param {string} location - The id of the target HTML element.
     */
    unmountShadowDom(location) {
        const host = document.getElementById(location);
        if (!host || !host.shadowRoot) return;
        host.shadowRoot.innerHTML = '';
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

	translate(text) {
		if (!this.translations) return text;
		var result = this.translations[text];
		if (result) return result;
		return text;
	}

    /** Authenticates a user by username and password, retrieves a token upon success.
     * @param {string} username - The username for authentication.
     * @param {string} password - The password for authentication.
     * @return {Promise<object>} - object has structure {user_id,user_role}
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
            if (res_obj.user_id) {
                return res_obj;
            } else {
                throw new Error('Authentication failed: No token received');
            }
        } catch (error) {
            console.error('Error during authentication:', error);
            return null;
        }
    }

 	/** Logs out user by deleting cookies
     */
    async logout() {
        try {
            const url = new URL('auth/logout', window.location.origin);
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) {
                throw new Error(`Error calling /auth/logout: ${res.statusText}`);
            }
            const res_obj = await res.json();
        } catch (error) {
            console.error('Error calling /auth/logout:', error);
            return null;
        }
    }

}