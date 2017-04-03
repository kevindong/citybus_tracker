let etas = [];
let board = [];
let routes;
let routeNames = {};
let stops;
let selectedRoutes = [];
let selectedRouteIds;
let selectedStops = [];
let selectedStopIds;
let lastUpdated;

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

function getETAs() {
	etas = []
	selectedStops.forEach((value) => {
		loadETA(value["id"]).then(function (value) {
			if (value !== undefined) {
				etas.push(value);
				refreshBoard();
			};
		});
	});
};

function refreshBoard() {
	board = []
	etas.forEach((value) => {
		value[Object.keys(value)[0]]['etas'].forEach((stopEta) => {
			if (selectedRouteIds.includes(routeNames[stopEta['route']])) {
				let scratch = {};
				scratch[routeNames[stopEta['route']]] = stopEta['avg'];
				board.push(scratch);
				board.sort(function(a, b) {
					return Object.values(a)[0] - Object.values(b)[0];
				});
			};
		});
	});
	let replacement = '';
	board.forEach((value) => {
		let key = Object.keys(value)[0];
		replacement += `${key}: ${value[key]} min. </br>`;
	})
	document.getElementById('next-bus').innerHTML = '';
	document.getElementById('next-bus').innerHTML = replacement;
	lastUpdated = new Date();
};

function loadSettings() {
	return new Promise(function(resolve, reject) {
		download('config.json').then(function (value) {
			selectedRouteIds = value['routes'];
			console.log('Loaded selectedRouteIds from config.json');
			selectedStopIds = value['stops'];
			console.log('Loaded selectedStopIds from config.json');
			stops.forEach((i) => {
				selectedStopIds.forEach((j) => {
					if (i["name"].includes(j)) {
						selectedStops.push(i);
					}
				});
			});
			routes.forEach((i) => {
				selectedRouteIds.forEach((j) => {
					if (i["short_name"] === j) {
						selectedRoutes.push(i);
					}
				});
				routeNames[i["id"]] = i["short_name"];
				routeNames[i["short_name"]] = i["id"];
			});
			console.log('Finished loading settings.');
			resolve();
		});
	});
};

function loadRoutes() {
	return new Promise(function(resolve, reject) {
		download('https://citybus.doublemap.com/map/v2/routes').then(function (value) {
			routes = value;
			console.log('Loaded routes from DoubleMap API');
			resolve();
		});
	});
};

function loadStops() {
	return new Promise(function(resolve, reject) {
		download('https://citybus.doublemap.com/map/v2/stops').then(function (value) {
			stops = value;
			console.log('Loaded stops from DoubleMap API');
			resolve();
		})
	});
};

function loadETA(stopId) {
	return new Promise(function(resolve, reject) {
		download(`https://citybus.doublemap.com/map/v2/eta?stop=${stopId}`).then(function (value) {
			resolve(value["etas"]);
		})
	});
};

function updateTime() {
	const now = new Date();
	document.getElementById('refreshed').innerHTML = "Updated: " + ((now.getTime() - lastUpdated.getTime()) / 1000).toFixed(0) + " seconds ago";
}