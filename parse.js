(function (root) {
  "use strict";

  var HEADER_MAP = {
    "loan officer": "Loan Officer",
    "date": "Date",
    "start": "Start",
    "end": "End",
    "realtor": "Realtor",
    "co-agent": "Co-Agent",
    "co agent": "Co-Agent",
    "phone": "Phone",
    "vip": "VIP",
    "relationship": "Relationship",
    "mls": "MLS",
    "mls #": "MLS",
    "price": "Price",
    "address": "Address",
    "city": "City",
    "class": "Class",
    "realtor link": "Realtor Link",
    "listing link": "Listing Link"
  };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function canonicalHeader(name) {
    return HEADER_MAP[String(name || "").trim().toLowerCase()] || "";
  }

  function isoDate(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function parseDate(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value === "number" && value > 20000 && value < 80000) {
      var utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
      return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
    }
    var text = String(value || "").trim();
    var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    var us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (us) {
      var year = Number(us[3]);
      if (year < 100) year += 2000;
      return new Date(year, Number(us[1]) - 1, Number(us[2]));
    }
    return null;
  }

  function formatClock(value) {
    var date = value;
    if (typeof value === "number" && value >= 0 && value < 1) {
      var minutes = Math.round(value * 24 * 60);
      date = new Date(1899, 11, 31, Math.floor(minutes / 60), minutes % 60);
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) return String(value || "").trim();
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function cleanValue(key, value) {
    if (value == null) return "";
    if ((key === "Start" || key === "End") && (value instanceof Date || (typeof value === "number" && value >= 0 && value < 1))) {
      return formatClock(value);
    }
    if (key === "Date") {
      var date = parseDate(value);
      return date ? isoDate(date) : "";
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      if (key === "Phone" || key === "MLS") return String(Math.round(value));
      if (key === "Price") return Math.round(value);
      return String(value);
    }
    return String(value).replace(/\u00a0/g, " ").trim();
  }

  function rowsFromObjects(objects) {
    var rows = [];
    (objects || []).forEach(function (object) {
      var row = {
        "Loan Officer": "",
        "Date": "",
        "Start": "",
        "End": "",
        "Realtor": "",
        "Co-Agent": "",
        "Phone": "",
        "VIP": "",
        "Relationship": "",
        "MLS": "",
        "Price": "",
        "Address": "",
        "City": "",
        "Class": "",
        "Realtor Link": "",
        "Listing Link": ""
      };
      var recognized = false;
      Object.keys(object || {}).forEach(function (key) {
        var canonical = canonicalHeader(key);
        if (!canonical) return;
        recognized = true;
        row[canonical] = cleanValue(canonical, object[key]);
      });
      if (!recognized) return;
      var hasContent = ["Realtor", "Address", "City", "MLS", "Phone", "Start"].some(function (key) {
        return row[key] !== "";
      });
      if (hasContent) rows.push(row);
    });
    return rows;
  }

  function weekFromRows(rows) {
    var stamps = [];
    rows.forEach(function (row) {
      var date = parseDate(row.Date);
      if (date) stamps.push(date.getTime());
    });
    if (!stamps.length) {
      return { weekLabel: "Undated", weekStart: "", weekEnd: "" };
    }
    stamps.sort(function (a, b) { return a - b; });
    var start = new Date(stamps[0]);
    var end = new Date(stamps[stamps.length - 1]);
    var label;
    if (isoDate(start) === isoDate(end)) {
      label = MONTHS[start.getMonth()] + " " + start.getDate() + ", " + start.getFullYear();
    } else if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      label = MONTHS[start.getMonth()] + " " + start.getDate() + "\u2013" + end.getDate() + ", " + start.getFullYear();
    } else if (start.getFullYear() === end.getFullYear()) {
      label = MONTHS[start.getMonth()] + " " + start.getDate() + "\u2013" + MONTHS[end.getMonth()] + " " + end.getDate() + ", " + start.getFullYear();
    } else {
      label = MONTHS[start.getMonth()] + " " + start.getDate() + ", " + start.getFullYear() + "\u2013" + MONTHS[end.getMonth()] + " " + end.getDate() + ", " + end.getFullYear();
    }
    return { weekLabel: label, weekStart: isoDate(start), weekEnd: isoDate(end) };
  }

  function fileFromRows(rows, extra) {
    var week = weekFromRows(rows);
    return {
      id: extra && extra.id ? extra.id : "",
      included: !!(extra && extra.included),
      uploadedAt: extra && extra.uploadedAt ? extra.uploadedAt : new Date().toISOString(),
      weekLabel: week.weekLabel,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      rows: rows
    };
  }

  function parseUpload(workbook) {
    var XLSX = root.XLSX;
    if (!XLSX) throw new Error("The file reader is not available.");
    var name = (workbook.SheetNames || [])[0];
    if (!name) throw new Error("That file has no sheet.");
    var objects = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "", raw: true });
    var rows = rowsFromObjects(objects);
    if (!rows.length) throw new Error("That file has no open-house rows.");
    var dated = rows.some(function (row) { return row.Date; });
    if (!dated) throw new Error("That file needs a Date column.");
    return fileFromRows(rows);
  }

  root.parseUpload = parseUpload;
  root.fileFromRows = fileFromRows;
  root.rowsFromObjects = rowsFromObjects;
})(typeof globalThis !== "undefined" ? globalThis : this);
