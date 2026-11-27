(function () {
  "use strict";

  var ARCHIVE_KEY = "openhouses.archive.v2";
  var UI_KEY = "openhouses.ui.v2";
  var NONE = "__none__";

  var officerSelect = document.getElementById("officer");
  var searchInput = document.getElementById("search");
  var clearButton = document.getElementById("clear");
  var daysEl = document.getElementById("days");
  var countEl = document.getElementById("count");
  var resultsEl = document.getElementById("results");
  var noticeEl = document.getElementById("notice");
  var fileInput = document.getElementById("file");
  var archiveToggle = document.getElementById("archiveToggle");
  var archivePanel = document.getElementById("archivePanel");

  var state = {
    archive: { activeId: "", files: [] },
    officer: "all",
    query: "",
    day: "all",
    archiveOpen: false
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function activeFile() {
    var files = state.archive.files || [];
    for (var i = 0; i < files.length; i += 1) {
      if (files[i].id === state.archive.activeId) return files[i];
    }
    return files[0] || null;
  }

  function loadArchive() {
    var seed = window.OPEN_HOUSES_SEED ? clone(window.OPEN_HOUSES_SEED) : null;
    var archive = { activeId: seed ? seed.id : "", files: seed ? [seed] : [] };
    try {
      var raw = localStorage.getItem(ARCHIVE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.files) && saved.files.length) archive = saved;
      }
    } catch (error) {
      /* start from the included file */
    }
    if (seed) {
      var refreshed = false;
      archive.files.forEach(function (file, index) {
        if (file.id === seed.id && file.included) {
          archive.files[index] = seed;
          refreshed = true;
        }
      });
      if (!refreshed && !archive.files.some(function (file) { return file.id === seed.id; })) {
        archive.files.unshift(seed);
      }
    }
    if (!archive.files.some(function (file) { return file.id === archive.activeId; })) {
      archive.activeId = archive.files.length ? archive.files[archive.files.length - 1].id : "";
    }
    return archive;
  }

  function persistArchive() {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(state.archive));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadUi() {
    try {
      var raw = sessionStorage.getItem(UI_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function persistUi() {
    try {
      sessionStorage.setItem(UI_KEY, JSON.stringify({
        officer: state.officer,
        query: state.query,
        day: state.day
      }));
    } catch (error) {
      /* session storage is optional */
    }
  }

  function setNotice(kind, text) {
    if (!text) {
      noticeEl.hidden = true;
      noticeEl.textContent = "";
      noticeEl.className = "notice";
      return;
    }
    noticeEl.hidden = false;
    noticeEl.className = "notice" + (kind === "err" ? " err" : "");
    noticeEl.textContent = text;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function officerName(row) {
    return String(row["Loan Officer"] || "").trim();
  }

  function formatPhone(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
    if (digits.length === 10) return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
    return String(value || "");
  }

  function formatPrice(value) {
    if (value === "" || value == null) return "";
    var number = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function timeLabel(row) {
    var start = String(row.Start || "").trim();
    var end = String(row.End || "").trim();
    if (start && end) return start + "\u2013" + end;
    return start || end;
  }

  function dateObject(iso) {
    var match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function dateHeading(iso) {
    var date = dateObject(iso);
    if (!date) return "Date not listed";
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }

  function chipLabel(iso) {
    var date = dateObject(iso);
    if (!date) return iso || "Date";
    return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3) + " " + date.getDate();
  }

  var SURNAME_PARTICLES = { van: 1, von: 1, de: 1, del: 1, da: 1, di: 1, st: 1, la: 1, le: 1, den: 1, der: 1 };

  function shortRealtor(name) {
    var raw = String(name || "").trim().split(/\s+/);
    if (raw.length <= 2) return raw.join(" ");
    var firstIndex = 0;
    if (raw[0].replace(/\./g, "").length === 1) firstIndex = 1;
    var last = raw[raw.length - 1];
    var particle = raw[raw.length - 2];
    if (particle && raw.length - 2 > firstIndex && SURNAME_PARTICLES[particle.replace(/\./g, "").toLowerCase()]) {
      last = particle + " " + last;
    }
    return raw[firstIndex] + " " + last;
  }

  function displayValue(column, row) {
    if (column === "Loan Officer") return officerName(row);
    if (column === "Time") return timeLabel(row);
    if (column === "Phone") return formatPhone(row.Phone);
    if (column === "Price") return formatPrice(row.Price);
    if (column === "Realtor") return shortRealtor(row.Realtor);
    if (column === "Co-Agent") return row["Co-Agent"] || "";
    if (column === "VIP") return row.VIP || "";
    if (column === "Relationship") return row.Relationship || "";
    if (column === "Address") return row.Address || "";
    if (column === "City") return row.City || "";
    if (column === "MLS") return row.MLS == null ? "" : String(row.MLS);
    if (column === "Class") return row.Class || "";
    return "";
  }

  function columnsFor(rows) {
    var order = ["Loan Officer", "Time", "Realtor", "Phone", "Price", "City", "Address", "Co-Agent", "MLS", "Class", "VIP", "Relationship"];
    return order.filter(function (column) {
      if (column === "Time" || column === "Realtor" || column === "Phone" || column === "City" || column === "Price" || column === "Address" || column === "MLS") return true;
      return rows.some(function (row) { return displayValue(column, row) !== ""; });
    });
  }

  function highlight(text, query) {
    var raw = String(text);
    var q = query.trim();
    if (!q) return escapeHtml(raw);
    if (raw.toLowerCase().indexOf(q.toLowerCase()) === -1) {
      var digitsQ = q.replace(/\D/g, "");
      var digitsRaw = raw.replace(/\D/g, "");
      if (digitsQ.length >= 3 && digitsRaw.indexOf(digitsQ) !== -1) return "<mark>" + escapeHtml(raw) + "</mark>";
      return escapeHtml(raw);
    }
    var re = new RegExp(escapeRegExp(q), "ig");
    var out = "";
    var last = 0;
    var match;
    while ((match = re.exec(raw))) {
      out += escapeHtml(raw.slice(last, match.index));
      out += "<mark>" + escapeHtml(match[0]) + "</mark>";
      last = match.index + match[0].length;
      if (!match[0].length) break;
    }
    return out + escapeHtml(raw.slice(last));
  }

  var priceFloorCache = { key: "", value: null };

  function rowPrice(row) {
    var value = row.Price;
    var number = typeof value === "number" ? value : Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(number) ? number : null;
  }

  function priceFloor(query) {
    var trimmed = String(query || "").trim();
    var file = activeFile();
    var key = (file && file.id ? file.id : "") + "\n" + trimmed;
    if (priceFloorCache.key === key) return priceFloorCache.value;
    var value = null;
    if (/^\$?\d{1,3}(?:,\d{3})+$/.test(trimmed) || /^\$?\d+$/.test(trimmed)) {
      var digits = trimmed.replace(/\D/g, "");
      var amount = Number(digits);
      var exactMls = !!(file && (file.rows || []).some(function (row) {
        return String(row.MLS == null ? "" : row.MLS).replace(/\D/g, "") === digits;
      }));
      if (!exactMls && digits.length >= 6 && digits.length <= 8 && amount >= 100000) value = amount;
    }
    priceFloorCache.key = key;
    priceFloorCache.value = value;
    return value;
  }

  function matches(row) {
    var q = state.query.trim().toLowerCase().replace(/,/g, "");
    if (!q) return true;
    var floor = priceFloor(state.query);
    if (floor != null) {
      var price = rowPrice(row);
      return price != null && price >= floor;
    }
    var parts = [
      officerName(row), row.Date, dateHeading(row.Date), timeLabel(row), row.Realtor, shortRealtor(row.Realtor), row["Co-Agent"],
      row.Phone, formatPhone(row.Phone), row.VIP, row.Relationship, row.MLS, row.Price, formatPrice(row.Price),
      row.Address, row.City, row.Class
    ];
    var hay = parts.join(" \n ").toLowerCase().replace(/,/g, "");
    if (hay.indexOf(q) !== -1) return true;
    var digitsQ = q.replace(/\D/g, "");
    return digitsQ.length >= 3 && hay.replace(/\D/g, "").indexOf(digitsQ) !== -1;
  }

  function inOfficer(row) {
    if (state.officer === "all") return true;
    if (state.officer === NONE) return !officerName(row);
    return officerName(row) === state.officer;
  }

  function visible(row) {
    if (!inOfficer(row)) return false;
    if (state.day !== "all" && row.Date !== state.day) return false;
    return matches(row);
  }

  function officersIn(file) {
    var names = {};
    var blank = false;
    (file.rows || []).forEach(function (row) {
      var name = officerName(row);
      if (name) names[name] = true;
      else blank = true;
    });
    return {
      names: Object.keys(names).sort(function (a, b) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
      }),
      blank: blank
    };
  }

  function datesIn(file) {
    var seen = {};
    var dates = [];
    (file.rows || []).forEach(function (row) {
      if (!inOfficer(row) || !row.Date || seen[row.Date]) return;
      seen[row.Date] = true;
      dates.push(row.Date);
    });
    dates.sort();
    return dates;
  }

  function renderOfficers(file) {
    var info = file ? officersIn(file) : { names: [], blank: false };
    officerSelect.replaceChildren();
    var all = document.createElement("option");
    all.value = "all";
    all.textContent = "All open houses";
    officerSelect.append(all);
    if (info.names.length) {
      var gap = document.createElement("option");
      gap.disabled = true;
      gap.textContent = "────────";
      officerSelect.append(gap);
    }
    info.names.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      officerSelect.append(option);
    });
    if (info.blank) {
      var gap2 = document.createElement("option");
      gap2.disabled = true;
      gap2.textContent = "────────";
      officerSelect.append(gap2);
      var none = document.createElement("option");
      none.value = NONE;
      none.textContent = "No loan officer";
      officerSelect.append(none);
    }
    var allowed = { all: true };
    info.names.forEach(function (name) { allowed[name] = true; });
    if (info.blank) allowed[NONE] = true;
    if (!allowed[state.officer]) state.officer = "all";
    officerSelect.value = state.officer;
  }

  function renderDays(file) {
    daysEl.replaceChildren();
    var dates = file ? datesIn(file) : [];
    if (state.day !== "all" && dates.indexOf(state.day) === -1) state.day = "all";
    if (dates.length < 2) {
      daysEl.hidden = true;
      return;
    }
    daysEl.hidden = false;
    var all = document.createElement("button");
    all.type = "button";
    all.className = "chip";
    all.dataset.day = "all";
    all.textContent = "All days";
    all.setAttribute("aria-pressed", state.day === "all" ? "true" : "false");
    daysEl.append(all);
    dates.forEach(function (iso) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.day = iso;
      button.textContent = chipLabel(iso);
      button.title = dateHeading(iso);
      button.setAttribute("aria-pressed", state.day === iso ? "true" : "false");
      daysEl.append(button);
    });
  }

  function classTitle(value) {
    var key = String(value || "").trim().toLowerCase();
    if (key === "res") return "Residential";
    if (key === "comm") return "Commercial";
    if (key === "land") return "Land";
    if (key === "multi") return "Multi-family";
    return "";
  }

  function colClass(column) {
    if (column === "Loan Officer") return "col-officer";
    if (column === "Address") return "col-address";
    if (column === "Realtor") return "col-realtor";
    if (column === "Co-Agent") return "col-coagent";
    if (column === "Time") return "col-time";
    if (column === "Phone") return "col-phone";
    if (column === "Price") return "col-price";
    if (column === "MLS") return "col-mls";
    if (column === "City") return "col-city";
    if (column === "Class") return "col-class";
    if (column === "VIP") return "col-vip";
    if (column === "Relationship") return "col-relationship";
    return "col-tag";
  }

  function safeUrl(value) {
    var text = String(value || "").trim();
    if (!/^https?:\/\//i.test(text)) return "";
    return text;
  }

  function linkHtml(url, inner, label) {
    if (!url) return inner;
    var title = label ? ' title="' + escapeHtml(label) + '"' : "";
    return '<a href="' + escapeHtml(url) + '"' + title + ' target="_blank" rel="noopener noreferrer">' + inner + "</a>";
  }

  function cellHtml(column, row) {
    var text = displayValue(column, row);
    if (!text) return '<span class="empty-cell">—</span>';
    var inner = highlight(text, state.query);
    if (column === "Phone") return '<span class="phone">' + inner + "</span>";
    if (column === "Address") return '<span class="address">' + inner + "</span>";
    if (column === "Realtor") {
      var full = String(row.Realtor || "").trim();
      var label = full && full !== text ? full : "";
      var url = safeUrl(row["Realtor Link"]);
      if (!url && label) return '<span title="' + escapeHtml(label) + '">' + inner + "</span>";
      return linkHtml(url, inner, label);
    }
    if (column === "MLS") return linkHtml(safeUrl(row["Listing Link"]), inner, "Open listing");
    if (column === "Co-Agent") return linkHtml(safeUrl(row["Co-Agent Link"]), inner, "");
    if (column === "VIP") {
      var yes = String(row.VIP).trim().toLowerCase() === "yes";
      return '<span class="pill ' + (yes ? "pill-yes" : "pill-no") + '">' + inner + "</span>";
    }
    if (column === "Relationship") {
      var core = /core/i.test(String(row.Relationship));
      return '<span class="pill ' + (core ? "pill-core" : "pill-target") + '">' + inner + "</span>";
    }
    if (column === "Class") {
      var title = classTitle(row.Class);
      var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : "";
      if (String(row.Class).trim().toLowerCase() === "res") return '<span class="class-res"' + titleAttr + ">" + inner + "</span>";
      return '<span class="pill pill-other"' + titleAttr + ">" + inner + "</span>";
    }
    return inner;
  }

  function countText(shown, total, week) {
    var noun = function (n) { return n === 1 ? "open house" : "open houses"; };
    var base = state.query.trim() ? shown + " of " + total : shown + " " + noun(shown);
    return week ? base + " · " + week : base;
  }

  var textProbe = null;

  function textWidth(text, style) {
    if (!textProbe) {
      textProbe = document.createElement("span");
      textProbe.style.position = "absolute";
      textProbe.style.left = "-9999px";
      textProbe.style.top = "0";
      textProbe.style.whiteSpace = "nowrap";
      document.body.appendChild(textProbe);
    }
    var family = getComputedStyle(document.body).fontFamily;
    textProbe.style.fontFamily = family;
    textProbe.style.fontSize = style.size;
    textProbe.style.fontWeight = style.weight || "400";
    textProbe.style.letterSpacing = style.spacing || "normal";
    textProbe.style.textTransform = style.transform || "none";
    textProbe.style.fontVariantNumeric = style.numeric || "normal";
    textProbe.textContent = text;
    return textProbe.getBoundingClientRect().width;
  }

  function widest(values, style, extra) {
    var best = 0;
    var seen = {};
    values.forEach(function (value) {
      if (!value || seen[value]) return;
      seen[value] = true;
      var width = textWidth(value, style) + (extra || 0);
      if (width > best) best = width;
    });
    return best;
  }

  function columnWidths(columns, rows) {
    var page = document.querySelector(".page");
    var total = Math.floor((page ? page.clientWidth : resultsEl.clientWidth) - 2);
    if (total < 320) return null;
    var cell = { size: "0.95rem", weight: "400" };
    var head = { size: "0.72rem", weight: "700", spacing: "0.06em", transform: "uppercase" };
    var pad = 16;
    var mins = {};
    columns.forEach(function (column) {
      var headerWidth = textWidth(column, head);
      var contentWidth = 0;
      var extra = 0;
      if (column === "Time") {
        var times = rows.map(timeLabel);
        times.push("12:00 PM\u201312:00 PM");
        contentWidth = widest(times, cell, 0);
      } else if (column === "Phone") {
        contentWidth = textWidth("(000) 000-0000", { size: "0.95rem", weight: "600" });
      } else if (column === "Price") {
        contentWidth = widest(rows.map(function (row) { return displayValue(column, row); }), { size: "0.95rem", weight: "400", numeric: "tabular-nums" }, 0);
      } else if (column === "VIP" || column === "Relationship" || column === "Class") {
        extra = 18;
        contentWidth = widest(rows.map(function (row) { return displayValue(column, row); }), { size: "0.78rem", weight: "700" }, extra);
      } else if (column === "City" || column === "Address" || column === "Co-Agent") {
        contentWidth = 0;
      } else if (column === "Realtor" || column === "MLS") {
        contentWidth = widest(rows.map(function (row) { return displayValue(column, row); }), { size: "0.95rem", weight: "700" }, 0);
      } else {
        contentWidth = widest(rows.map(function (row) { return displayValue(column, row); }), cell, 0);
      }
      mins[column] = Math.ceil(Math.max(headerWidth, contentWidth) + pad);
    });
    var flexNames = { City: 1, Address: 1.8, "Co-Agent": 1.15 };
    var widths = {};
    var fixedSum = 0;
    columns.forEach(function (column) {
      if (flexNames[column]) return;
      widths[column] = mins[column];
      fixedSum += mins[column];
    });
    var flex = columns.filter(function (column) { return flexNames[column]; });
    var remain = total - fixedSum;
    var weightSum = flex.reduce(function (sum, column) { return sum + flexNames[column]; }, 0) || 1;
    var used = 0;
    flex.forEach(function (column, index) {
      var share = index === flex.length - 1
        ? remain - used
        : Math.floor(remain * flexNames[column] / weightSum);
      widths[column] = Math.max(72, share);
      used += widths[column];
    });
    return widths;
  }

  function renderResults() {
    var file = activeFile();
    if (!file) {
      countEl.textContent = "";
      resultsEl.innerHTML = '<div class="empty"><h2>No open houses yet</h2><p>Use Replace to add a CSV. It will stay in the archive.</p></div>';
      return;
    }
    var pool = (file.rows || []).filter(inOfficer);
    var scoped = state.day === "all" ? pool : pool.filter(function (row) { return row.Date === state.day; });
    var rows = scoped.filter(matches).map(function (row, index) {
      return { row: row, index: index };
    }).sort(function (a, b) {
      if (a.row.Date < b.row.Date) return -1;
      if (a.row.Date > b.row.Date) return 1;
      return a.index - b.index;
    }).map(function (item) { return item.row; });
    countEl.textContent = countText(rows.length, scoped.length, file.weekLabel);
    document.title = (file.weekLabel || "Open houses") + " · Open Houses";

    if (!rows.length) {
      var title = state.query.trim() || state.day !== "all" ? "No matches" : "No open houses";
      var floor = priceFloor(state.query);
      var body = floor != null
        ? "Nothing in this week is " + formatPrice(floor) + " or more."
        : state.query.trim()
          ? "Nothing in this week contains that search."
          : "Nothing is listed for that day.";
      resultsEl.innerHTML = '<div class="empty"><h2>' + escapeHtml(title) + "</h2><p>" + escapeHtml(body) + "</p></div>";
      return;
    }

    var columns = columnsFor(file.rows || []);
    var groups = [];
    var current = null;
    rows.forEach(function (row) {
      var key = row.Date || "";
      if (!current || current.key !== key) {
        current = { key: key, rows: [] };
        groups.push(current);
      }
      current.rows.push(row);
    });

    var head = columns.map(function (column) {
      return '<th class="' + colClass(column) + '">' + escapeHtml(column) + "</th>";
    }).join("");
    var body = groups.map(function (group) {
      var day = '<tr class="day"><th colspan="' + columns.length + '">' + escapeHtml(dateHeading(group.key)) + ' <span class="day-count">' + group.rows.length + '<span class="sr-only"> open houses</span></span></th></tr>';
      var lines = group.rows.map(function (row) {
        var other = String(row.Class || "").trim().toLowerCase();
        other = other !== "" && other !== "res";
        var cells = columns.map(function (column) {
          var empty = displayValue(column, row) === "";
          return '<td class="' + colClass(column) + (empty ? " is-empty" : "") + '" data-label="' + escapeHtml(column) + '"><span>' + cellHtml(column, row) + "</span></td>";
        }).join("");
        return '<tr class="house' + (other ? " is-other" : "") + '">' + cells + "</tr>";
      }).join("");
      return day + lines;
    }).join("");
    var widths = columnWidths(columns, file.rows || []);
    var cols = "<colgroup>" + columns.map(function (column) {
      var size = widths && widths[column] ? ' style="width:' + widths[column] + 'px"' : "";
      return '<col class="' + colClass(column) + '"' + size + ">";
    }).join("") + "</colgroup>";
    resultsEl.innerHTML = '<div class="table-wrap"><table>' + cols + '<caption class="sr-only">Open houses for ' + escapeHtml(file.weekLabel) + '</caption><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function uploadStamp(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "Saved file";
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function renderArchive() {
    archiveToggle.setAttribute("aria-expanded", state.archiveOpen ? "true" : "false");
    archivePanel.hidden = !state.archiveOpen;
    archivePanel.replaceChildren();
    if (!state.archiveOpen) return;
    var groups = [];
    var byWeek = {};
    (state.archive.files || []).forEach(function (file) {
      var key = file.weekStart || file.weekLabel || "undated";
      if (!byWeek[key]) {
        byWeek[key] = { key: key, label: file.weekLabel || "Undated", files: [] };
        groups.push(byWeek[key]);
      }
      byWeek[key].files.push(file);
    });
    groups.sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : 0; });
    if (!groups.length) {
      var empty = document.createElement("p");
      empty.className = "archive-empty";
      empty.textContent = "No files saved yet.";
      archivePanel.append(empty);
      return;
    }
    groups.forEach(function (group) {
      var heading = document.createElement("p");
      heading.className = "archive-week";
      heading.textContent = group.label;
      archivePanel.append(heading);
      group.files.slice().sort(function (a, b) {
        return String(b.uploadedAt).localeCompare(String(a.uploadedAt));
      }).forEach(function (file) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "archive-item";
        button.dataset.id = file.id;
        if (file.id === state.archive.activeId) button.setAttribute("aria-current", "true");
        var label = document.createElement("span");
        label.textContent = file.included ? "Included" : uploadStamp(file.uploadedAt);
        button.append(label);
        if (file.id === state.archive.activeId) {
          var now = document.createElement("span");
          now.className = "archive-now";
          now.textContent = "On screen";
          button.append(now);
        }
        archivePanel.append(button);
      });
    });
  }

  function render() {
    var file = activeFile();
    renderOfficers(file);
    renderDays(file);
    clearButton.hidden = !state.query.trim();
    renderResults();
    renderArchive();
    persistUi();
  }

  function openFile(id) {
    state.archive.activeId = id;
    state.officer = "all";
    state.day = "all";
    state.query = "";
    searchInput.value = "";
    state.archiveOpen = false;
    var saved = persistArchive();
    if (!saved) setNotice("err", "This week is open, but the browser could not store the archive.");
    render();
    return saved;
  }

  resultsEl.addEventListener("mousedown", function (event) {
    if (event.detail < 2) return;
    if (!event.target.closest(".phone, .address")) return;
    event.preventDefault();
  });

  resultsEl.addEventListener("dblclick", function (event) {
    var target = event.target.closest(".phone, .address");
    if (!target) return;
    event.preventDefault();
    var selection = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
  });

  officerSelect.addEventListener("change", function () {
    state.officer = officerSelect.value;
    render();
  });

  searchInput.addEventListener("input", function () {
    state.query = searchInput.value;
    render();
  });

  clearButton.addEventListener("click", function () {
    state.query = "";
    searchInput.value = "";
    searchInput.focus();
    render();
  });

  daysEl.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-day]");
    if (!button) return;
    state.day = button.dataset.day;
    render();
  });

  archiveToggle.addEventListener("click", function (event) {
    event.stopPropagation();
    state.archiveOpen = !state.archiveOpen;
    renderArchive();
  });

  archivePanel.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-id]");
    if (!button) return;
    event.stopPropagation();
    var saved = openFile(button.dataset.id);
    var file = activeFile();
    if (saved && file) setNotice("", "Opened " + file.weekLabel + " from the archive.");
  });

  document.addEventListener("click", function () {
    if (!state.archiveOpen) return;
    state.archiveOpen = false;
    renderArchive();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.archiveOpen) {
      state.archiveOpen = false;
      renderArchive();
    }
  });

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    setNotice("", "Reading the file…");
    var reader = new FileReader();
    reader.onload = function () {
      try {
        if (!window.XLSX || !window.parseUpload) throw new Error("reader missing");
        var workbook;
        if (/\.csv$/i.test(file.name)) {
          var text = new TextDecoder("utf-8").decode(reader.result).replace(/^\uFEFF/, "");
          workbook = window.XLSX.read(text, { type: "string", cellDates: true });
        } else {
          workbook = window.XLSX.read(new Uint8Array(reader.result), { type: "array", cellDates: true });
        }
        var parsed = window.parseUpload(workbook);
        parsed.id = "file-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
        parsed.included = false;
        parsed.uploadedAt = new Date().toISOString();
        state.archive.files.push(parsed);
        state.archive.activeId = parsed.id;
        state.officer = "all";
        state.day = "all";
        state.query = "";
        searchInput.value = "";
        state.archiveOpen = false;
        var saved = persistArchive();
        render();
        setNotice(saved ? "" : "err", saved
          ? parsed.weekLabel + " is on screen. The previous file is still in the archive."
          : parsed.weekLabel + " is on screen, but the browser could not store the archive.");
      } catch (error) {
        setNotice("err", "That file needs a header row with Date, and one open house per row. Nothing was removed.");
      }
    };
    reader.onerror = function () {
      setNotice("err", "That file could not be read. Nothing was removed.");
    };
    reader.readAsArrayBuffer(file);
  });

  var savedUi = loadUi();
  state.query = savedUi.query || "";
  state.day = savedUi.day || "all";
  state.officer = savedUi.officer || "all";
  searchInput.value = state.query;
  state.archive = loadArchive();
  persistArchive();
  render();
  if (document.fonts && document.fonts.status !== "loaded") {
    document.fonts.ready.then(function () { render(); });
  }
})();
