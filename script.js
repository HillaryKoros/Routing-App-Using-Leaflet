// Initialize map and set view to a default location
const map = L.map('map').setView([0.0236, 37.9062], 7);

// Add OpenStreetMap tile layer to the map
const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markerIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [12, 20],
    iconAnchor: [9, 12],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [15, 15]
});

let routingControl = null;
let markers = [];
let waypoints = [];
let routeInfo = null;

// Function to detect current location
function detectLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const latLng = [position.coords.latitude, position.coords.longitude];
            map.setView(latLng, 13);
            addWaypoint(latLng);
        });
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

// Function to handle map clicks
function handleMapClick(e) {
    addWaypoint(e.latlng);
}

// Function to add waypoint
function addWaypoint(latLng) {
    const marker = L.marker(latLng, { icon: markerIcon, draggable: true }).addTo(map);
    marker.on('dragend', calculateRoute);
    markers.push(marker);
    waypoints.push(latLng);

    if (waypoints.length >= 2) {
        calculateRoute();
    }
}

// Function to calculate and display route
function calculateRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
    }

    const mode = document.getElementById('transportMode').value;
    routingControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: true,
        lineOptions: {
            styles: [{ color: '#6FA1EC', weight: 4 }]
        },
        createMarker: function() { return null; },
        router: L.Routing.osrmv1({
            profile: 'car',  // Always use 'car' profile for routing
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        })
    }).addTo(map);

    routingControl.on('routesfound', function(e) {
        const routes = e.routes;

        routeInfo = {
            routes: routes.map(route => ({
                summary: route.summary,
                averageSpeed: getAverageSpeed(route.summary.totalDistance, route.summary.totalTime),
                coordinates: route.coordinates,
                instructions: route.instructions
            })),
            start: routes[0].waypoints[0].latLng,
            end: routes[0].waypoints[routes[0].waypoints.length - 1].latLng
        };

        updateRouteInfoDisplay();
    });
}

// Helper function to get average speed
function getAverageSpeed(distance, time) {
    return (distance / time) * 3600 / 1000; // km/h
}


// Function to update route information display
function updateRouteInfoDisplay() {
    document.getElementById('routeInfo').innerHTML = `
        <strong>Total Distance:</strong> ${routeInfo.distance} km<br>
        <strong>Estimated Time:</strong> ${routeInfo.time} minutes<br>
        <strong>Average Speed:</strong> ${routeInfo.averageSpeed} km/h<br>
        <strong>Transport Mode:</strong> ${document.getElementById('transportMode').value}
    `;
}

// Function to clear route and markers
function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    waypoints = [];
    document.getElementById('routeInfo').innerHTML = "";
}

// Helper function to get text representation of instruction type
function getInstructionIcon(type) {
    switch (type) {
        case 'Head':
        case 'Straight':
            return '↑';
        case 'TurnRight':
            return '→';
        case 'TurnLeft':
            return '←';
        case 'SlightRight':
            return '↗';
        case 'SlightLeft':
            return '↖';
        default:
            return '•';
    }
}

// Function to export route as PDF
function exportRouteAsPDF() {
    if (!routeInfo) {
        alert("Please calculate a route first.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let yOffset = 10;
    doc.setFontSize(12);
    doc.text(`Start: ${routeInfo.start.lat.toFixed(4)}, ${routeInfo.start.lng.toFixed(4)}`, 10, yOffset);
    yOffset += 10;
    doc.text(`End: ${routeInfo.end.lat.toFixed(4)}, ${routeInfo.end.lng.toFixed(4)}`, 10, yOffset);
    yOffset += 10;
    doc.text(`Distance: ${routeInfo.distance} km`, 10, yOffset);
    yOffset += 10;
    doc.text(`Estimated Time: ${routeInfo.time} minutes`, 10, yOffset);
    yOffset += 10;
    doc.text(`Average Speed: ${routeInfo.averageSpeed} km/h`, 10, yOffset);
    yOffset += 20;

    routeInfo.instructions.forEach((instruction, index) => {
        const icon = getInstructionIcon(instruction.type);
        const distance = instruction.distance ? `${(instruction.distance / 1000).toFixed(2)} km` : '';
        doc.text(`${icon} ${instruction.text} ${distance}`, 10, yOffset);
        yOffset += 10;
    });

    doc.save('route_information.pdf');
}

// Function to export route as CSV
function exportRouteAsCSV() {
    if (!routeInfo) {
        alert("Please calculate a route first.");
        return;
    }

    let csvContent = `Start Latitude,Start Longitude,End Latitude,End Longitude,Total Distance (km),Estimated Time (min),Average Speed (km/h)\n`;
    csvContent += `${routeInfo.start.lat.toFixed(4)},${routeInfo.start.lng.toFixed(4)},${routeInfo.end.lat.toFixed(4)},${routeInfo.end.lng.toFixed(4)},${routeInfo.distance},${routeInfo.time},${routeInfo.averageSpeed}\n\n`;
    csvContent += `Instruction Type,Instruction Text,Distance (km)\n`;

    routeInfo.instructions.forEach((instruction) => {
        const icon = getInstructionIcon(instruction.type);
        const distance = instruction.distance ? `${(instruction.distance / 1000).toFixed(2)}` : '';
        csvContent += `${icon},${instruction.text},${distance}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'route_information.csv';
    link.click();
}


// Function to format time as hours and minutes
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
}

// Function to export route as GeoJSON
function exportRouteAsGeoJSON() {
    if (!routeInfo || !routeInfo.routes) {
        alert("Please calculate a route first.");
        return;
    }

    // Prepare GeoJSON data with route segments
    const features = routeInfo.routes.map((route, index) => ({
        type: "Feature",
        properties: {
            distance: (route.summary.totalDistance / 1000).toFixed(2) + " km",
            time: formatTime(route.summary.totalTime / 60),
            averageSpeed: (route.averageSpeed || 0) + " km/h",
            transportMode: document.getElementById('transportMode').value,
            instructions: route.instructions.map(instr => ({
                type: instr.type,
                text: instr.text,
                distance: instr.distance ? (instr.distance / 1000).toFixed(2) : ''
            }))
        },
        geometry: {
            type: "LineString",
            coordinates: route.coordinates.map(coord => [coord.lng, coord.lat])
        }
    }));

    const geojson = {
        type: "FeatureCollection",
        features: features
    };

    console.log("GeoJSON Data:", geojson); // Debugging output

    // Convert GeoJSON to a Blob
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'route.geojson';
    link.click();
}




// Event listeners
map.on('click', handleMapClick);

document.getElementById('clearRoute').addEventListener('click', clearRoute);
document.getElementById('detectLocation').addEventListener('click', detectLocation);

document.getElementById('exportRoute').addEventListener('click', function() {
    const format = document.getElementById('exportFormat').value;
    if (format === 'pdf') {
        exportRouteAsPDF();
    } else if (format === 'csv') {
        exportRouteAsCSV();
    } else if (format === 'geojson') {
        exportRouteAsGeoJSON();
    }
});

// Initialize transport mode change listener
document.getElementById('transportMode').addEventListener('change', calculateRoute);
