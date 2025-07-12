/*@webcogs_system_prompt
# Docs for writing a plugin

A plugin is a module that can interact with the user via HTML widgets, or process information.  A plugin is always defined as a single export class, and should be written in vanilla Javascript. Do not assume any libraries are available.  For example jquery is not available.  The class constructor always has this signature: 
constructor(core, ...custom_params). Parameter "core" is the core object, which contains the core API functions.  The constructor can be any number of additional custom parameters.

The plugin class is constructed when the core app invokes the plugin, and can be destroyed and constructed any number of times during the app's lifecycle.

## Core functions

The following functions are available to all plugins, via the "core" object.

function core.mount(location, html_code, css_code) - Show a widget to the user by mounting the given HTML in a shadow DOM.  Returns the shadow root element, which should be used to query the HTML inside the widget.  It is possible for a plugin to have multiple widgets, or none.
core.mount has the following parameters:
- location - a string, indicating where to place the user interface element.  The complete set of available locations is defined in the section "available core.mount locations".  Use only these.
- html_code - a string with a HTML snippet that contains the user interface for the widget
- css_code - corresponding styling for html_code.  This should be a CSS snippet.  The \<style\> tag should not be included.

function core.route(route, ...custom_params) - Invoke the core router.
core.route has the following parameters:
- route - a string describing the route. The format of the route is defined in the section "core.route routes". Use only these.
- custom_params - there can be any number of custom parameters.

## Core properties

core.db is a SQLite compatible database object. It has the following functions: 
- async function db.run(sql_statement, optional_values) - execute a SQL statement or query. Note this is an async function. If it is a query, returns an array of objects, otherwise returns null. Each object represents a record, with keys representing the column names and values the record values. If optional_values is supplied, it should be an array, with its elements bound to "?" symbols in the sql_statement string. For example: db.run("SELECT * FROM my_table WHERE id=?",[1000]) will be interpolated to "SELECT * FROM my_table where id=1000". 

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Widgets should always display a title.

Use the classes, styles, and properties in the supplied CSS definitions as much as possible.


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --nav_bar-bg-color: #eee;
  --top_menu-bg-color: #222;
  --top-menu-text-color: #fff;
  --button-bg-color: #aaf;
  --button-text-color: #006;
}


## SQL table definitions

CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    birth_date DATE NOT NULL
);

CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user INTEGER NOT NULL,
	text TEXT NOT NULL,
	entry_date DATE NOT NULL,
	response_date DEFAULT NULL,
    response_text TEXT DEFAULT NULL
);

@webcogs_user_prompt
Show a bar chart that shows the number of submitted tickets per day over the last 30 days.
@webcogs_end_prompt_section*/
// TicketsBarChartPlugin.js
// A plugin that displays a bar chart with the amount of submitted tickets per
// day during the last 30 days.

class TicketsBarChartPlugin {
    constructor(core) {
        this.core = core;
        this.init();
    }

    /**
     * Initialise the widget: mount HTML/CSS, then query data and draw the chart.
     */
    async init() {
        const html = `
            <div class="ticket-chart-widget">
                <h2>Tickets per Day (Last 30 days)</h2>
                <canvas id="chartCanvas" width="800" height="400"></canvas>
            </div>
        `;

        const css = `
            .ticket-chart-widget {
                background-color: var(--main-bg-color);
                color: var(--text-color);
                padding: 1rem;
                box-sizing: border-box;
                width: 100%;
            }
            .ticket-chart-widget h2 {
                margin: 0 0 1rem 0;
                font-size: 1.25rem;
            }
            canvas {
                width: 100%;
                max-width: 100%;
                border: 1px solid #ccc;
            }
        `;

        // Mount the widget in the main area and keep a reference to the shadow root.
        this.shadowRoot = this.core.mount("main", html, css);
        this.canvas = this.shadowRoot.getElementById("chartCanvas");
        this.ctx = this.canvas.getContext("2d");

        // Load data and draw the chart.
        await this.loadDataAndDraw();
    }

    /**
     * Query the database for ticket counts and feed the chart.
     */
    async loadDataAndDraw() {
        // Calculate date range: from 29 days ago (inclusive) to today (inclusive)
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - 29);

        const toSQLDate = (dateObj) => {
            return dateObj.toISOString().split("T")[0]; // YYYY-MM-DD
        };

        const startDateStr = toSQLDate(startDate);

        // Query counts grouped by day ≥ startDate
        const query = `SELECT entry_date AS date, COUNT(*) AS count
                       FROM Ticket
                       WHERE entry_date >= ?
                       GROUP BY entry_date`;
        const rows = await this.core.db.run(query, [startDateStr]);

        // Map date -> count for quick lookup
        const countsMap = {};
        rows.forEach(r => {
            countsMap[r.date] = r.count;
        });

        // Assemble ordered labels & counts (30 values, oldest to newest)
        this.labels = [];
        this.counts = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const label = toSQLDate(d);
            this.labels.push(label);
            this.counts.push(countsMap[label] || 0);
        }

        this.drawChart();
    }

    /**
     * Draws a simple bar chart directly on the canvas.
     */
    drawChart() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        const w = canvas.width;
        const h = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Chart layout settings
        const paddingLeft = 50;
        const paddingBottom = 40;
        const paddingTop = 20;
        const paddingRight = 20;
        const chartWidth = w - paddingLeft - paddingRight;
        const chartHeight = h - paddingTop - paddingBottom;
        const barWidth = chartWidth / 30;

        // Determine max count for scaling
        const maxCount = Math.max(...this.counts, 1);

        // Draw Y axis and horizontal grid lines
        ctx.strokeStyle = "#000";
        ctx.beginPath();
        ctx.moveTo(paddingLeft, paddingTop);
        ctx.lineTo(paddingLeft, h - paddingBottom);
        ctx.lineTo(w - paddingRight, h - paddingBottom);
        ctx.stroke();

        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#000";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        const yStep = Math.ceil(maxCount / 5) || 1;
        for (let yVal = 0; yVal <= maxCount; yVal += yStep) {
            const y = h - paddingBottom - (yVal / maxCount) * chartHeight;
            ctx.fillText(yVal.toString(), paddingLeft - 5, y);
            // Grid line
            ctx.strokeStyle = "#ddd";
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(w - paddingRight, y);
            ctx.stroke();
        }

        // Draw bars
        ctx.fillStyle = "steelblue";
        for (let i = 0; i < 30; i++) {
            const count = this.counts[i];
            const barHeight = (count / maxCount) * chartHeight;
            const x = paddingLeft + i * barWidth + barWidth * 0.1;
            const y = h - paddingBottom - barHeight;
            ctx.fillRect(x, y, barWidth * 0.8, barHeight);
        }

        // Draw X-axis labels (show every 5th day to avoid clutter)
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#000";
        for (let i = 0; i < 30; i += 5) {
            const x = paddingLeft + i * barWidth + barWidth / 2;
            // show MM-DD for brevity
            const label = this.labels[i].substring(5);
            ctx.fillText(label, x, h - paddingBottom + 4);
        }
    }

    /**
     * Optional cleanup if the plugin gets destroyed.
     */
    destroy() {
        if (this.shadowRoot && this.shadowRoot.host) {
            this.shadowRoot.host.remove();
        }
    }
}

// Export the plugin class (CommonJS & ES module compatibility)
if (typeof module !== "undefined" && module.exports) {
    module.exports = TicketsBarChartPlugin;
}

export default TicketsBarChartPlugin;