let x_routes;
let x_routeNames = {};
let x_stops;
let x_selectedRoutes = [];
let x_selectedRouteIds;
let x_selectedStops = [];
let x_selectedStopIds;

function download(url) {
    return new Promise(function(resolve, reject) {
        const request = new XMLHttpRequest();
        request.overrideMimeType('application/json');
        request.open('GET', url);
        request.onload = function() {
            if (request.status === 200) {
                console.log(`Received response to GET ${url}`);
                resolve(JSON.parse(request.response));
            } else {
                console.log(`Failed to receive response to GET ${url}`);
                reject('Error');
            }
        };
        request.send();
    });
};

function loadSettings() {
    return new Promise(function(resolve, reject) {
        download('config.json').then(function (value) {
            x_selectedRouteIds = value['routes'];
            console.log('Loaded selectedRouteIds from config.json');
            x_selectedStopIds = value['stops'];
            console.log('Loaded selectedStopIds from config.json');
            x_stops.forEach((i) => {
                x_selectedStopIds.forEach((j) => {
                    if (i["name"].includes(j)) {
                        x_selectedStops.push(i);
                    }
                });
            });
            x_routes.forEach((i) => {
                x_selectedRouteIds.forEach((j) => {
                    if (i["short_name"] === j) {
                        x_selectedRoutes.push(i);
                    }
                });
                x_routeNames[i["id"]] = i["short_name"];
                x_routeNames[i["short_name"]] = i["id"];
            });
            console.log('Finished loading settings.');
            resolve();
        });
    });
};

function loadRoutes() {
    return new Promise(function(resolve, reject) {
        download('https://citybus.doublemap.com/map/v2/routes').then(function (value) {
            x_routes = value;
            console.log('Loaded routes from DoubleMap API');
            resolve();
        });
    });
};

function loadStops() {
    return new Promise(function(resolve, reject) {
        download('https://citybus.doublemap.com/map/v2/stops').then(function (value) {
            x_stops = value;
            console.log('Loaded stops from DoubleMap API');
            resolve();
        })
    });
};

loadRoutes().then(loadStops).then(loadSettings);



if (!Function.prototype.bind) Function.prototype.bind = function(oThis) {
    if (typeof this !== "function") throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    var aArgs = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP = function() {},
        fBound = function() {
            return fToBind.apply(this instanceof fNOP && oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
        };
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();
    return fBound;
};
if (!Array.prototype.indexOf) Array.prototype.indexOf = function(obj, start) {
    for (var i = (start || 0), j = this.length; i < j; i++)
        if (this[i] === obj) return i;
    return -1;
};

function DoubleMap() {
    if (!(this instanceof DoubleMap)) return new DoubleMap.apply(null, arguments);
    this.initialize.apply(this, arguments);
}

function appendRoutesCookie(route_id) {
    var cookie_routes = getCookie("displayed_routes");
    cookie_routes = cookie_routes + route_id + ",";
    setCookie("displayed_routes", cookie_routes, 30);
}

function popRoutesCookie(route_id) {
    var cookie_routes = getCookie("displayed_routes");
    if (cookie_routes == null) return;
    var route_ids = cookie_routes.split(",");
    var new_cookie_routes = "";
    for (var i = 0; i < route_ids.length; i++)
        if (route_ids[i] != route_id && route_ids[i] != "") new_cookie_routes = new_cookie_routes + route_ids[i] + ",";
    setCookie("displayed_routes", new_cookie_routes, 30);
}

function test_visibility(route_id) {
    var cookie_routes = getCookie("displayed_routes");
    if (cookie_routes == null) return false;
    var route_ids = cookie_routes.split(",");
    for (var i = 0; i < route_ids.length; i++)
        if (route_ids[i] == route_id) return true;
    return false;
}

function setCookie(c_name, value, exdays) {
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value = escape(value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
    document.cookie = c_name + "=" + c_value;
}

function getCookie(c_name) {
    var c_value = document.cookie;
    var c_start = c_value.indexOf(" " + c_name + "=");
    if (c_start == -1) c_start = c_value.indexOf(c_name + "=");
    if (c_start == -1) c_value = null;
    else {
        c_start = c_value.indexOf("=", c_start) + 1;
        var c_end = c_value.indexOf(";", c_start);
        if (c_end == -1) c_end = c_value.length;
        c_value = unescape(c_value.substring(c_start, c_end));
    }
    return c_value;
}
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame;
})();
DoubleMap.prototype = (function($) {
    var DM;
    var map;
    var infoWindow;
    var buses = [];
    var busIds = [];
    var busIcons = {};
    var enableUpdates = true;
    var enableAnimation = true;
    var updateInterval = 10000;
    var animateInterval = 300;
    var idleTimeout = 15 * 60 * 1000;
    var jumpThreshold = 300;
    var routes = [];
    var routeIds = [];
    var fetchRoutesIntervalId;
    var FETCH_ROUTES_DELAY = 1000 * 60 * 5;
    var stops = [];
    var stopIds = [];
    var stopTemplate;
    var upDownImg = '<img src="img/up_down.png" /> ';
    var isMobile = false;
    var setTick = function(tick) {
        animateInterval = tick;
    };
    var setRoute = function(id, on) {
        if (on !== undefined) on = !!on;
        routes[id].toggle(on);
    };
    var setAllRoutes = function(on) {
        on = !!on;
        for (var i = 0; i < routeIds.length; i++) {
            var r = routes[routeIds[i]];
            r.toggle(on);
        }
    };
    var setMobile = function(mobile) {
        isMobile = mobile;
    };
    var isCanvasSupported = function() {
        var elem = document.createElement('canvas');
        return !!(elem.getContext && elem.getContext('2d'));
    };
    var canvasSupport = isCanvasSupported();
    var invalidateAnimation = false;
    var pathLayerGroup;
    var stopIconLayerGroup;
    var initialize = function(mapDiv, DMlocal, lat, lon, zoom) {
        DM = DMlocal;
        zoom = 15;
        initMap(mapDiv, 40.42591, -86.91833, zoom);
        pathLayerGroup = L.layerGroup();
        pathLayerGroup.addTo(map);
        stopIconLayerGroup = L.layerGroup();
        stopIconLayerGroup.addTo(map);
        infoWindow = new L.popup();
        setupInfoWindow();
        fetchRoutes(true);
        fetchRoutesIntervalId = setInterval(fetchRoutes.bind(null, false), FETCH_ROUTES_DELAY);
        setupTimeout();
        $(window).blur(function() {
            invalidateAnimation = true;
        });
        var browser = get_browser_info();
        var unsupported = $("#unsupported-browser");
        var unsupported_button = $("#unsupported-button");
        if (!is_browser_supported(browser) || !is_version_supported(browser)) unsupported.show();
        unsupported_button.click(function() {
            unsupported.hide();
        });
    };
    var setupInfoWindow = function() {
        stopTemplate = '<div id="stop-details" class="stop-info">' + '<div class="heading <% if (stop.description) { %>no-border<% } %>" >' + '<a href="#mobile-stop-details" data-dismiss="details" class="close only-xs pull-right">X</a>' + '<h3><%- stop.name %></h3>' + '</div>' + '<% if (stop.description) { %>' + '<div class="info-row description">' + '<div class="label-value">' + '<%- stop.description %>' + '</div>' + '</div>' + '<% } %>' + (DM.show_eta === true ? '<div class="info-row next-busses">' + '<div class="info-label">Next buses</div>' + '<div class="info-value routes"></div>' + '</div>' : '') + '<% if (buddy) { %>' + '<div class="info-row related-stop">' + '<div class="info-label">Related stop</div>' + '<div class="label-value">' + '<a class="stop-buddy" href="#" data-route="<%= route.id %>" data-buddy="<%= stop.buddy %>"><%= buddy.name %></a>' + '</div>' + '</div>' + '<% } %>' + '</div>';
    };

    function parseHash() {
        var hash = window.location.hash;
        var field = hash.substring(1).split("&");
        var result = {};
        for (var i = 0; i < field.length; i++) {
            var split = field[i].indexOf("=");
            if (split <= 1) result[field[i]] = "";
            else result[field[i].substring(0, split)] = field[i].substring(split + 1);
        }
        return result;
    }
    var initMap = function(mapDiv, lat, lon, zoom) {
        if (window.location.hash) {
            var fields = parseHash();
            if (fields.lat !== undefined) lat = fields.lat;
            if (fields.lon !== undefined) lon = fields.lon;
            if (fields.zoom !== undefined) zoom = fields.zoom;
            if (fields.star === 'true') var showStarIcon = true;
        }
        var dmLayer = new L.tileLayer('//tiles.doublemap.com/dmtest/{z}/{x}/{y}.png');
        var openmq = new L.tileLayer('http://otile1.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpg');
        var cm_dm01 = new L.tileLayer('https://ssl-tiles.cloudmade.com/6407adc7f5fb49558f16bf8df0a504f5/119094/256/{z}/{x}/{y}.png', {
            attribution: 'Contains map data from <a href="http://openstreetmap.org/">OpenStreetMap</a>'
        });
        var mb_tm2 = new L.tileLayer('https://api.tiles.mapbox.com/v3/erjiang.hk3an929/{z}/{x}/{y}.png32', {
            attribution: 'Base map data &copy; <a href="http://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        });
        var mb_sat = new L.tileLayer('https://api.tiles.mapbox.com/v3/erjiang.h6e947al/{z}/{x}/{y}.png32', {
            attribution: "Imagery by MapBox"
        });
        var mapOptions = {
            zoom: zoom,
            center: [lat, lon],
            minZoom: 11,
            maxZoom: 17,
            layers: [mb_tm2]
        };
        if ("showControls" in DM && DM.showControls === false) {
            mapOptions.panControl = false;
            mapOptions.zoomControl = false;
            mapOptions.mapTypeControl = false;
            mapOptions.scaleControl = false;
            mapOptions.locateControl = false;
        }
        map = new L.map('map', mapOptions);
        //var marker = L.marker([40.423428292479, -86.910278762]).addTo(map);
        map.attributionControl.setPrefix(false);
        if (mapOptions.mapTypeControl !== false) L.control.layers({
            "Roadmap": mb_tm2,
            "Satellite": mb_sat
        }).addTo(map);
        if (mapOptions.locateControl !== false && L.control.locate) L.control.locate().addTo(map);
        map.on('zoomstart', function() {
            enableAnimation = false;
        });
        map.on('zoomend', function() {
            enableAnimation = true;
        });
        map.on('moveend', clipVisibleStops);
        if (showStarIcon == true) {
            var starIcon = L.icon({
                iconUrl: 'img/star_icon.png',
                iconSize: [22, 22],
                iconAnchor: [10, 10]
            });
            L.marker([lat, lon], {
                icon: starIcon
            }).addTo(map);
        }
    };
    var fetchRoutes = function(first) {
        $.getJSON("https://citybus.doublemap.com/map/v2/routes", function(data) {
            var routes_visible = 0;
            var bounds = null;
            var incomingRouteIds = [];
            var recentRouteIds = [];
            var outgoingRoutes = false;
            for (var i = 0; i < data.length; i++) recentRouteIds.push(data[i].id);
            for (var i = 0; i < routeIds.length; i++)
                if (recentRouteIds.indexOf(routeIds[i]) === -1) {
                    outgoingRoutes = true;
                    removeRoute(routeIds[i]);
                }
            for (var i = 0, len = data.length; i < len; i++) {
                var thisRouteIsIncoming = routeIds.indexOf(data[i].id) === -1;
                if (thisRouteIsIncoming) incomingRouteIds.push(data[i].id);
            }





            setTimeout( function () {
            for (var i = 0, len = data.length; i < len; i++) {
                var r = data[i];
                var thisRouteIsNew = incomingRouteIds.indexOf(r.id) !== -1;
                if (thisRouteIsNew) {
                    routes[r.id] = r;
                    routeIds.push(r.id);
                    var points = [];
                    for (var p = 0, pl = r.path.length; p < pl; p += 2) points.push(new L.LatLng(r.path[p], r.path[p + 1]));
                    if (x_selectedRouteIds.includes(x_routeNames[r.id])) {
                        console.log('enabled ' + x_routeNames[r.id]);
                        r.visible = true;
                    }
                    else r.visible = false;
                    //if (DM.embed) r.visible = false;
                    //else if (DM.passive) r.visible = true;
                    //else r.visible = !DM.hideRoutes && r.active !== false && test_visibility(r.id);
                    if (r.visible) routes_visible += 1;
                    r.polyline = new L.Polyline(points, {
                        color: "#" + r.color,
                        opacity: 0.6,
                        weight: 4
                    });
                    r.polyline.on('mouseover', function(routeId) {
                        return function() {
                            highlightRoute(routeId, true);
                        };
                    }(r.id));
                    r.polyline.on('mouseout', function(routeId) {
                        return function() {
                            highlightRoute(routeId, false);
                        };
                    }(r.id));
                    r.toggle = function(r) {
                        return function(state) {
                            if (state === undefined) r.visible = !r.visible;
                            else r.visible = state;
                            if (r.visible) appendRoutesCookie(r.id);
                            else popRoutesCookie(r.id);
                            showRoute(r.id, r.visible);
                            for (var i = 0, len = busIds.length; i < len; i++) {
                                var b = buses[busIds[i]];
                                if (b.route == r.id)
                                    if (r.visible) map.addLayer(b.icon);
                                    else map.removeLayer(b.icon);
                            }
                            stillHere();
                            return r.visible;
                        };
                    }(r);
                    DM.addRoute(r, r.toggle);
                    if (r.visible) pathLayerGroup.addLayer(r.polyline);
                    if (r.visible && DM.embed)
                        if (bounds === null) bounds = L.latLngBounds(r.polyline.getLatLngs());
                        else bounds.extend(r.polyline.getLatLngs());
                }
            }
        }, 1000);







            if (bounds != null) map.fitBounds(bounds);
            map.invalidateSize();
            if ("setInitMenu" in DM) DM.setInitMenu(routes_visible == 0);
            else if (routes_visible == 0 && DM.embed !== true && DM.firstTime && first) DM.firstTime();
            if (first) {
                fetchStops();
                fetchBuses(false);
                setTimeout(fetchBuses, 1500);
            } else if (incomingRouteIds.length > 0 || outgoingRoutes) updateMapWithStops();
            if (window.requestAnimFrame === undefined) animateTick();
            else window.requestAnimFrame(animateTick);
        });
    };
    var fetchStops = function() {
        $.getJSON("https://citybus.doublemap.com/map/v2/stops", function(dat) {
            var i = dat.length;
            var s;
            while (i--) {
                s = dat[i];
                stops[s.id] = s;
                stopIds.push(s.id);
            }
            updateMapWithStops();
        });
    };
    var updateMapWithStops = function() {
        var i = routeIds.length;
        var icons;
        var si;
        var r;
        var s;
        stopIconLayerGroup.clearLayers();
        while (i--) {
            r = routes[routeIds[i]];
            s = r.stops;
            si = s.length;
            icons = (r.stopIcons = []);
            while (si--) icons.push(makeStopIcon(stops[s[si]], routes[routeIds[i]], false));
        }
        clipVisibleStops();
    };
    var makeStopIcon = (function() {
        var iconCache = [];
        return function(stop, route, show) {
            if (stop === undefined) return;
            var mark = new L.Marker(new L.LatLng(stop.lat, stop.lon), {
                title: stop.name,
                icon: iconCache[route.id] ? iconCache[route.id] : iconCache[route.id] = new L.icon({
                    iconUrl: getStopIconURL(route.color),
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                })
            });
            if (show !== false) mark.addTo(stopIconLayerGroup);
            if (isMobile) setupMobileStopWindow(mark, stop, route);
            else setupStopWindow(mark, stop, route);
            return mark;
        };
    })();
    var getStopIconURL = function(color) {
        if (canvasSupport === true) {
            var can = document.createElement('canvas');
            can.setAttribute('width', 10);
            can.setAttribute('height', 10);
            var ctx = can.getContext("2d");
            ctx.fillStyle = "#" + color;
            ctx.beginPath();
            ctx.arc(5, 5, 4.5, Math.PI * 2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            return can.toDataURL();
        } else return 'img/colorize?img=stop_icon&color=' + color;
    };
    var routeTemplate = '<table>' + '<tr>' + '<td style="color: #<%= r.color %>"><%- r.name %></td>' + '<td>' + '<% if (eta && eta.avg-1 > 0) { %>' + '<%= (eta.avg-1) %>-<%= eta.avg %>' + '<% } else { %>0-1<% } %> min</li>' + '</td>' + '</tr>' + '</table>';
    var fetchStopRoutes = function(stopId, routeId) {
        if (!("show_eta" in DM) || DM.show_eta !== true) return;
        $('div.routes table').remove();
        $.each(routeIds, function(index, r) {
            var route = routes[r];
            $.each(route.stops, function(index, s) {
                var stop = stops[s];
                if (stop.id == stopId) {
                    $('div.routes').append(_.template(routeTemplate, {
                        route: routes[routeId],
                        r: route,
                        stop: stop,
                        eta: {}
                    }));
                    return false;
                }
            });
        });
    };
    var stopInfoWindow = function(marker, stop, route, content) {
        infoWindow.setContent(content).setLatLng(marker.getLatLng()).openOn(map);
        fetchStopRoutes(stop, route);
        fetchETA(stop, route);
        $('.stop-buddy').on('click', clickBuddyRouteHandler);
    };
    var setupStopWindow = function(marker, stop, route, hasBuddy) {
        var content = _.template(stopTemplate, {
            stop: stop,
            route: route,
            buddy: stops[stop.buddy]
        });
        if (hasBuddy) {
            stopInfoWindow(marker, stop.id, route.id, content);
            map.setView(marker.getLatLng(), 16);
        } else marker.on('click', function() {
            stopInfoWindow(marker, stop.id, route.id, content);
            map.setView(marker.getLatLng(), 16);
        });
    };
    var mobileStopInfoWindow = function(marker, stop, route, content) {
        $('#mobile-stop-details').html(_.template(content, {
            stop: stop
        }));
        fetchStopRoutes(stop.id, route.id);
        fetchETA(stop.id, route.id);
        $('.stop-buddy').on('click', mobileBuddyRouteHandler);
    };
    var setupMobileStopWindow = function(marker, stop, route, hasBuddy) {
        var content = _.template(stopTemplate, {
            stop: stop,
            route: route,
            buddy: stops[stop.buddy]
        });
        if (hasBuddy) {
            mobileStopInfoWindow(marker, stop, route, content);
            map.setView(adjustMarkerPosition(marker.getLatLng(), 16), 16);
        } else marker.on('click', function() {
            mobileStopInfoWindow(marker, stop, route, content);
            map.setView(adjustMarkerPosition(marker.getLatLng(), 16), 16);
            $('#mobile-stop-details').slideDown('slow');
        });
    };
    var mobileBuddyRouteHandler = function() {
        var buddyStopId = $(this).data('buddy');
        var routeId = $(this).data('route');
        var stop = stops[buddyStopId];
        var route = routes[routeId];
        var iconCache = [];
        var mark = new L.Marker(new L.LatLng(stop.lat, stop.lon), {
            title: stop.name,
            icon: iconCache[route.id] ? iconCache[route.id] : iconCache[route.id] = new L.icon({
                iconUrl: getStopIconURL(route.color),
                iconSize: [10, 10],
                iconAnchor: [5, 5]
            })
        });
        setupMobileStopWindow(mark, stop, route, true);
        return false;
    };

    function clipVisibleStops() {
        var limit = 200;
        var bounds = map.getBounds();
        var numVisible = 0;
        for (var ri = 0; ri < routeIds.length; ri++) {
            var r = routes[routeIds[ri]];
            if (r.stopIcons === undefined || !pathLayerGroup.hasLayer(r.polyline)) continue;
            for (var si = 0; si < r.stopIcons.length; si++) {
                var marker = r.stopIcons[si];
                if (marker === undefined) continue;
                if (bounds.contains(marker.getLatLng())) {
                    numVisible++;
                    if (!stopIconLayerGroup.hasLayer(marker)) stopIconLayerGroup.addLayer(marker);
                } else if (stopIconLayerGroup.hasLayer(marker)) stopIconLayerGroup.removeLayer(marker);
            }
        }
        if (numVisible > limit && map.hasLayer(stopIconLayerGroup)) map.removeLayer(stopIconLayerGroup);
        else if (numVisible <= limit && !map.hasLayer(stopIconLayerGroup)) map.addLayer(stopIconLayerGroup);
    }
    var adjustMarkerPosition = function(position, zoom) {
        var lat = position.lat + (0.001 - (zoom - 16) * 0.0003);
        return new L.LatLng(lat, position.lng);
    };
    var clickBuddyRouteHandler = function() {
        var buddyStopId = $(this).data('buddy');
        var routeId = $(this).data('route');
        var stop = stops[buddyStopId];
        var route = routes[routeId];
        var iconCache = [];
        var mark = new L.Marker(new L.LatLng(stop.lat, stop.lon), {
            title: stop.name,
            icon: iconCache[route.id] ? iconCache[route.id] : iconCache[route.id] = new L.icon({
                iconUrl: getStopIconURL(route.color),
                iconSize: [10, 10],
                iconAnchor: [5, 5]
            })
        });
        setupStopWindow(mark, stop, route, true);
        return false;
    };
    var clickRouteHandler = function() {
        fetchETA($(this).data('stop'), $(this).data('route'));
        fetchPremiumPlacements($(this).data('stop'), $(this).data('route'));
        return false;
    };
    var fetchETA = function(stopId, routeId) {
        if (!("show_eta" in DM) || DM.show_eta !== true) return;
        $('div.routes table').remove();
        $('div.routes').append('<p class="waiting">Waiting for bus data...</p>');
        $.getJSON('https://citybus.doublemap.com/map/v2/eta?stop=' + stopId, function(data) {
            $('div.routes p').remove();
            var route_color = routes[routeId].color;
            if (data.etas[stopId]) _.each(data.etas[stopId].etas, function(e) {
                $('div.routes').append(_.template(routeTemplate, {
                    route: routes[e.route],
                    r: routes[e.route],
                    stop: stops[stopId],
                    eta: e
                }));
            });
            else $('div.routes').append('No ETA currently available.');
        });
    };
    var fetchBuses = function(autoNext) {
        if (!enableUpdates) return;
        if (autoNext !== false) setTimeout(fetchBuses, updateInterval);
        $.getJSON("https://citybus.doublemap.com/map/v2/buses", function(dat) {
            var b;
            var e;
            for (var i = 0, len = dat.length; i < len; i++) {
                b = dat[i];
                if ((e = buses[b.id])) {
                    if (b.route != e.route) {
                        map.removeLayer(e.icon);
                        delete buses[b.id];
                        rember(b.id, busIds);
                    } else {
                        if (b.lastUpdate - e.lastUpdate > 60) moveBus(e.id, b.lat, b.lon);
                        else if (haversine(e.lat, e.lon, b.lat, b.lon) > jumpThreshold) moveBus(e.id, b.lat, b.lon);
                        e.lat = b.lat;
                        e.lon = b.lon;
                        e.lastStop = b.lastStop;
                        e.lastUpdate = b.lastUpdate;
                    }
                    e.live = true;
                    if (typeof routes[b.route] !== "undefined")
                        if (routes[b.route].visible !== true) map.removeLayer(e.icon);
                }
                if (buses[b.id] === undefined && typeof routes[b.route] !== "undefined") {
                    b.ilat = b.lat;
                    b.ilon = b.lon;
                    b.live = true;
                    buses[b.id] = b;
                    busIds.push(b.id);
                    b.icon = createBusIcon(b);
                }
            }
            for (var i = 0, len = busIds.length; i < len; i++) {
                b = buses[busIds[i]];
                if (!b) continue;
                if (b.live !== true) {
                    buses[b.id] = undefined;
                    map.removeLayer(b.icon);
                    rember(b.id, busIds);
                    i--;
                } else b.live = undefined;
            }
        }).fail(function() {
            $('#connection-message').show();
        }).success(function() {
            $('#connection-message').hide();
        });
    };
    var removeRoute = function(routeId) {
        var r = routes[routeId];
        showRoute(routeId, false);
        routeIds.splice(routeIds.indexOf(routeId), 1);
        delete routes[routeId];
        DM.removeRoute(r);
    };
    var highlightRoute = function(routeId, state) {
        var r = routes[routeId];
        if (!r.visible) return;
        var p = r.polyline;
        if (state === true) {
            p.setStyle({
                opacity: 1.0,
                weight: 6
            });
            p.bringToFront();
            if (r.stopIcons !== undefined)
                for (var i = 0; i < r.stopIcons.length; i++) r.stopIcons[i].setZIndexOffset(1);
        } else {
            p.setStyle({
                opacity: 0.6,
                weight: 4
            });
            if (r.stopIcons !== undefined)
                for (var i = 0; i < r.stopIcons.length; i++) r.stopIcons[i].setZIndexOffset(0);
        }
    };
    var createBusIcon = function(bus) {
        var annotation;
        var color;
        if ('busAnnotation' in DM && DM.busAnnotation == 'bus_id') annotation = encodeURIComponent(bus.name);
        else if (routes[bus.route] === undefined) annotation = "";
        else annotation = encodeURIComponent(routes[bus.route].short_name);
        if (routes[bus.route] === undefined) color = '333333';
        else color = encodeURIComponent(routes[bus.route].color);
        var iconImage = 'https://citybus.doublemap.com/map/img/colorize?img=bus_icon&color=' + color + '&annotate=' + annotation;
        var icon = new L.Marker([bus.lat, bus.lon], {
            clickable: false,
            title: "Bus " + bus.name,
            icon: new L.Icon({
                iconUrl: iconImage,
                iconSize: [27, 34],
                iconAnchor: [13, 34],
                shadowUrl: 'https://citybus.doublemap.com/map/img/bus_icon_shadow.png',
                shadowSize: [35, 29],
                shadowAnchor: [10, 28]
            })
        });
        if (routes[bus.route].visible) icon.addTo(map);
        return icon;
    };
    var moveBus = function(busId, lat, lon) {
        var b = buses[busId];
        var route = routes[b.route];
        if (!route || route.visible == false) map.removeLayer(b.icon);
        if (route === undefined) {
            b.icon.setLatLng(new L.LatLng(lat, lon));
            b.ilat = lat;
            b.ilon = lon;
        } else {
            var newloc = nearest_point_polyline(lat, lon, route.path, 80);
            b.icon.setLatLng(new L.LatLng(newloc[0], newloc[1]));
            b.ilat = newloc[0];
            b.ilon = newloc[1];
        }
    };

    function showRoute(routeId, show) {
        var r = routes[routeId];
        var stopAddOrRemove = (show === false) ? stopIconLayerGroup.removeLayer : stopIconLayerGroup.addLayer;
        var routeAddOrRemove = (show === false) ? pathLayerGroup.removeLayer : pathLayerGroup.addLayer;
        routeAddOrRemove.call(pathLayerGroup, r.polyline);
        var si = r.stopIcons.length;
        var bounds = map.getBounds();
        while (si--)
            if (r.stopIcons[si] !== undefined && bounds.contains(r.stopIcons[si].getLatLng())) stopAddOrRemove.call(stopIconLayerGroup, r.stopIcons[si]);
    }
    var lastTick = new Date().getTime();
    var animateTick = function() {
        var now = new Date().getTime();
        var msElapsed = now - lastTick;
        var jump = false;
        lastTick = now;
        if (!enableUpdates) return;
        if (window.requestAnimFrame === undefined) setTimeout(animateTick, animateInterval);
        else window.requestAnimFrame(animateTick);
        if (!enableAnimation) return;
        var percentage = msElapsed / updateInterval;
        if (percentage > 1) jump = true;
        for (var i = 0, len = busIds.length; i < len; i++) {
            var b = buses[busIds[i]];
            var route = routes[b.route];
            var rlat = b.lat;
            var rlon = b.lon;
            var ilat = b.ilat;
            var ilon = b.ilon;
            if (Math.abs(rlat - ilat) > 0.00002 || Math.abs(rlon - ilon) > 0.00002)
                if (jump || invalidateAnimation) {
                    b.ilat = rlat;
                    b.ilon = rlon;
                    if (route === undefined) b.icon.setLatLng(new L.LatLng(b.lat, b.lon));
                    else {
                        var newloc = nearest_point_polyline(ilat, ilon, route.path, 80);
                        b.icon.setLatLng(new L.LatLng(newloc[0], newloc[1]));
                    }
                } else {
                    ilat += (b.lat - ilat) * percentage;
                    ilon += (b.lon - ilon) * percentage;
                    if (route === undefined) b.icon.setLatLng(new L.LatLng(ilat, ilon));
                    else {
                        var newloc = nearest_point_polyline(ilat, ilon, route.path, 80);
                        b.icon.setLatLng(new L.LatLng(newloc[0], newloc[1]));
                    }
                    b.ilat = ilat;
                    b.ilon = ilon;
                }
        }
        invalidateAnimation = false;
    };
    var supported_browsers = {
        firefox: 10,
        chrome: 30,
        msie: 9,
        safari: 5
    };

    function get_browser_info() {
        var ua = navigator.userAgent,
            tem, M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
        if (/trident/i.test(M[1])) {
            tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
            return {
                name: 'msie',
                version: (tem[1] || '')
            };
        }
        if (M[1] === 'Chrome') {
            tem = ua.match(/\bOPR\/(\d+)/);
            if (tem != null) return {
                name: 'Opera',
                version: tem[1]
            };
        }
        M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
        if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
        return {
            name: M[0],
            version: M[1]
        };
    }

    function is_browser_supported(browser) {
        return browser.name.toLowerCase() in supported_browsers;
    }

    function is_version_supported(browser) {
        return parseInt(browser.version) >= supported_browsers[browser.name.toLowerCase()];
    }
    var timeSinceLastAction = 0;

    function setupTimeout() {
        map.on('click', stillHere);
        map.on('move', stillHere);
        map.on('zoom', stillHere);
        map.on('mouseover', stillHere);
        stillThere();
    }

    function stillThere() {
        if (timeSinceLastAction > idleTimeout) {
            enableUpdates = false;
            if (DM.timeOut) DM.timeOut(function() {
                enableUpdates = true;
                setTimeout(stillThere, 1000);
                animateTick();
            });
            timeSinceLastAction = 0;
        } else {
            timeSinceLastAction += 1000;
            setTimeout(stillThere, 1000);
        }
    }

    function stillHere() {
        timeSinceLastAction = 0;
    }

    function haversine(lat1, lon1, lat2, lon2) {
        var R = 6371000;
        var dLat = toRad(lat2 - lat1);
        var dLon = toRad(lon2 - lon1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c;
        return d;
    }

    function nearest_point_polyline(px, py, polyline, limit) {
        var nearest_point = [px, py];
        var nearest_dist = limit;
        if (polyline.length < 4) return nearest_point;
        for (var i = 0; i < polyline.length - 3; i += 2) {
            var nearest = nearest_point_segment(px, py, polyline[i + 0], polyline[i + 1], polyline[i + 2], polyline[i + 3]);
            var dist = haversine(px, py, nearest[0], nearest[1]);
            if (dist < nearest_dist) {
                nearest_point = nearest;
                nearest_dist = dist;
            }
        }
        return nearest_point;
    }

    function nearest_point_segment(px, py, vx, vy, wx, wy) {
        if (vx == wx && vy == wy) return [vx, vy];
        var l2 = (vx - wx) * (vx - wx) + (vy - wy) * (vy - wy);
        var t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
        if (t < 0) return [vx, vy];
        else if (t > 1.0) return [wx, wy];
        var projx = vx + t * (wx - vx);
        var projy = vy + t * (wy - vy);
        return [projx, projy];
    }

    function toRad(degree) {
        return degree * Math.PI / 180;
    }

    function rember(val, arr) {
        for (var i = 0, len = arr.length; i < len; i++)
            if (arr[i] === val) {
                arr.splice(i, 1);
                break;
            }
        return arr;
    }
    return {
        initialize: initialize,
        setTick: setTick,
        setRoute: setRoute,
        setAllRoutes: setAllRoutes,
        highlightRoute: highlightRoute,
        setMobile: setMobile
    };
})(jQuery);
jQuery(function($) {
    var annB = $("#announcements");
    if (annB.length == 0) return;
    $.getJSON('https://citybus.doublemap.com/map/v2/announcements', function(dat) {
        var obj, linkedMessage;
        if (dat.length == 0) annB.append($("<em>").text("No new announcements"));
        else
            for (var i = 0, l = dat.length; i < l; i++) {
                obj = dat[i];
                linkedMessage = escapeHtml(obj.message);
                linkedMessage = formatLineBreaks(linkedMessage);
                linkedMessage = detectLinks(linkedMessage);
                annB.append($("<h3>").text(obj.title)).append($("<p>").html(linkedMessage));
            }
    });
    return;
});
var DMutil = {};
DMutil.fillSysInfo = function(form) {
    var addVal = function(name, val) {
        var el = $('<input type="hidden" />');
        el.attr('name', name);
        el.val(val);
        form.append(el);
    };
    addVal("url", window.location);
    addVal("ua", navigator.userAgent);
    addVal("winWidth", window.innerWidth);
    addVal("winHeight", window.innerHeight);
    addVal("lang", navigator.language || navigator.userLanguage);
    addVal("scrWidth", screen.width);
    addVal("scrHeight", screen.height);
};

function detectLinks(str) {
    return str.replace(/\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[A-Z0-9+&@#/%=~_|]/ig, function(url) {
        return '<a href="' + url + '">' + url + '</a>';
    });
}

function formatLineBreaks(str) {
    return str.replace(/\r?\n/g, '<br />');
}

function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}