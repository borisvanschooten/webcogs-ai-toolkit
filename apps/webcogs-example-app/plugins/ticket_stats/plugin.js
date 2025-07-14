/*@webcogs_system_prompt
# Docs for writing a plugin

A plugin is a module that can interact with the user via HTML widgets, or process information.  A plugin is always defined as a single export class, and should be written in vanilla Javascript. Do not assume any libraries are available.  For example jquery is not available, so do not call $(...).  The class constructor always has this signature: 
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


-- User role is one of: user, developer, admin
CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    organization TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL
);

-- Ticket status is same as status of last response
-- Status can be: open, in_progress, fixed, not_fixed
CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user INTEGER NOT NULL,
	text TEXT NOT NULL,
	time DATETIME NOT NULL,
    status TEXT NOT NULL
);

-- A ticket can have any number of responses
-- Each response sets the status or text fields, or both
CREATE TABLE Response (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Show a bar chart that shows the number of submitted tickets per day over the last 30 days. Show dates in the form mm-dd at the x axis, and ticks on the y axis.
@webcogs_end_prompt_section*/
export default class TicketsPerDayChart {
  constructor(core) {
    this.core = core;
    // Mount the widget in the main area
    this.shadow = core.mount(
      'main',
      `
        <div id="wrapper">
          <h2>Tickets per Day (Last 30 Days)</h2>
          <canvas id="chart" width="800" height="400"></canvas>
        </div>
      `,
      `
        #wrapper {
          padding: 16px;
          color: var(--text-color);
          background-color: var(--main-bg-color);
          font-family: Arial, sans-serif;
        }
        canvas {
          border: 1px solid #ccc;
          background-color: #fafafa;
          width: 100%;
          max-width: 100%;
        }
      `
    );

    this.canvas = this.shadow.getElementById('chart');
    this.ctx = this.canvas.getContext('2d');

    // kick-off async initialisation
    this.init();
  }

  // Fetch data and draw the chart
  async init() {
    try {
      // Build list of date strings for the last 30 days (ISO yyyy-mm-dd)
      const today = new Date();
      const dateStrings = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().slice(0, 10); // yyyy-mm-dd
        dateStrings.push(iso);
      }

      const startDate = dateStrings[0];
      const endDate = dateStrings[dateStrings.length - 1];

      // Query database for counts per day
      const rows = await this.core.db.run(
        `SELECT date(time) AS day, COUNT(*) AS cnt
         FROM Ticket
         WHERE date(time) BETWEEN ? AND ?
         GROUP BY day`,
        [startDate, endDate]
      );
      console.log(rows)
      // Map DB results to a dictionary {day: count}
      const countsByDay = {};
      rows.forEach(r => {
        countsByDay[r.day] = r.cnt;
      });

      // Build array of counts aligned with dateStrings order
      const counts = dateStrings.map(d => countsByDay[d] || 0);

      // Draw chart
      this.drawChart(dateStrings, counts);
    } catch (err) {
      console.error('Error initialising TicketsPerDayChart plugin:', err);
    }
  }

  // Draw a simple bar chart on the canvas
  drawChart(dateStrings, counts) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, W, H);

    // Layout settings
    const margin = { top: 30, right: 20, bottom: 60, left: 40 };
    const chartW = W - margin.left - margin.right;
    const chartH = H - margin.top - margin.bottom;

    // Determine Y axis max (at least 5 so we have ticks)
    const maxValue = Math.max(...counts, 5);
    const yTickCount = 5;
    const yTickStep = Math.ceil(maxValue / yTickCount);
    const adjustedMax = yTickStep * yTickCount;

    // Bar dimensions
    const barCount = counts.length;
    const barWidth = chartW / barCount;

    // Draw bars
    ctx.fillStyle = '#4a90e2';
    counts.forEach((val, idx) => {
      const barHeight = (val / adjustedMax) * chartH;
      const x = margin.left + idx * barWidth + barWidth * 0.1;
      const y = margin.top + chartH - barHeight;
      const bw = barWidth * 0.8;
      ctx.fillRect(x, y, bw, barHeight);
    });

    // Axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    // Y axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartH);
    ctx.lineTo(margin.left + chartW, margin.top + chartH);
    ctx.stroke();

    // Y axis ticks & labels
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= yTickCount; i++) {
      const yValue = i * yTickStep;
      const y = margin.top + chartH - (yValue / adjustedMax) * chartH;
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
      ctx.fillText(yValue.toString(), margin.left - 7, y);
    }

    // X axis labels (mm-dd)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    dateStrings.forEach((isoDate, idx) => {
      // Show every 5th label for readability, always show first & last
      if (idx % 5 !== 0 && idx !== dateStrings.length - 1 && idx !== 0) return;
      const label = isoDate.slice(5); // mm-dd
      const x = margin.left + idx * barWidth + barWidth / 2;
      const y = margin.top + chartH + 5;
      ctx.fillText(label, x, y);
    });
  }
}
