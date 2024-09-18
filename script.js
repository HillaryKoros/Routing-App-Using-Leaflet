// Initialize map and set view to a default location
const map = L.map('map').setView([0.0236, 37.9062], 7);

// Add OpenStreetMap tile layer to the map
const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Define custom icon for the marker
const markerIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41]
});

let routingControl = null;
let markers = [];
let animatedMarker = null;
let routeInfo = null;
let routeInstructions = [];

// Function to handle map clicks
function handleMapClick(e) {
    if (markers.length < 2) {
        const marker = L.marker(e.latlng, { icon: markerIcon }).addTo(map);
        markers.push(marker);

        if (markers.length === 2) {
            calculateRoute();
        }
    }
}

// Function to calculate and display route
function calculateRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
        waypoints: [
            markers[0].getLatLng(),
            markers[1].getLatLng()
        ],
        routeWhileDragging: true,
        lineOptions: {
            styles: [{ color: '#6FA1EC', weight: 4 }]
        },
        createMarker: function() { return null; }
    }).addTo(map);

    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        const summary = routes[0].summary;
        
        // Calculate average speed in km/h
        const averageSpeed = (summary.totalDistance / 1000) / (summary.totalTime / 3600);
        
        // Store route information
        routeInfo = {
            distance: (summary.totalDistance / 1000).toFixed(2),
            time: Math.round(summary.totalTime / 60),
            averageSpeed: averageSpeed.toFixed(2),
            start: routes[0].waypoints[0].latLng,
            end: routes[0].waypoints[1].latLng,
            coordinates: routes[0].coordinates
        };

        // Capture turn-by-turn instructions
        routeInstructions = routes[0].instructions.map(instruction => ({
            type: instruction.type,
            text: instruction.text,
            distance: instruction.distance,
            time: instruction.time
        }));

        // Display route information
        updateRouteInfoDisplay();

        // Animate marker along the route
        if (animatedMarker) {
            map.removeLayer(animatedMarker);
        }
        animatedMarker = L.marker(routes[0].coordinates[0], { icon: markerIcon }).addTo(map);
        animateMarker(routes[0].coordinates, averageSpeed);
    });
}

function updateRouteInfoDisplay() {
    let instructionsHTML = '<h3>Turn-by-Turn Instructions:</h3><ul>';
    routeInstructions.forEach(instruction => {
        instructionsHTML += `<li>${instruction.text} - ${(instruction.distance / 1000).toFixed(2)} km</li>`;
    });
    instructionsHTML += '</ul>';

    document.getElementById('routeInfo').innerHTML = `
        <strong>Total Distance:</strong> ${routeInfo.distance} km<br>
        <strong>Estimated Time:</strong> ${routeInfo.time} minutes<br>
        <strong>Average Speed:</strong> ${routeInfo.averageSpeed} km/h
        ${instructionsHTML}
    `;
}

// Function to export route information as PDF
function exportToPDF() {
    // Ensure jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF is not loaded');
        alert('Unable to generate PDF. Please check your internet connection and try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Route Information', 10, 10);
    doc.setFontSize(12);
    doc.text(`Total Distance: ${routeInfo.distance} km`, 10, 20);
    doc.text(`Estimated Time: ${routeInfo.time} minutes`, 10, 30);
    doc.text(`Average Speed: ${routeInfo.averageSpeed} km/h`, 10, 40);

    doc.setFontSize(14);
    doc.text('Turn-by-Turn Instructions:', 10, 55);
    doc.setFontSize(10);
    let y = 65;
    routeInstructions.forEach((instruction, index) => {
        if (y > 280) {
            doc.addPage();
            y = 10;
        }
        const text = `${index + 1}. ${instruction.text} - ${(instruction.distance / 1000).toFixed(2)} km`;
        doc.text(text, 10, y, { maxWidth: 180 });
        y += 10;
    });

    doc.save('route_instructions.pdf');
}

// Function to export route information as CSV
function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Total Distance (km),Estimated Time (minutes),Average Speed (km/h)\n";
    csvContent += `${routeInfo.distance},${routeInfo.time},${routeInfo.averageSpeed}\n\n`;
    
    csvContent += "Step,Instruction,Distance (km)\n";
    routeInstructions.forEach((instruction, index) => {
        csvContent += `${index + 1},"${instruction.text.replace(/"/g, '""')}",${(instruction.distance / 1000).toFixed(2)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "route_instructions.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Function to export route information
function exportRoute() {
    const format = document.getElementById('exportFormat').value;
    if (routeInfo && routeInstructions.length > 0) {
        if (format === 'pdf') {
            exportToPDF();
        } else if (format === 'csv') {
            exportToCSV();
        }
    } else {
        alert('No route to export. Please calculate a route first.');
    }
}


 // Function to clear the route and markers
 function clearRoute() {
     if (routingControl) {
         map.removeControl(routingControl);
         routingControl = null;
     }
     markers.forEach(marker => map.removeLayer(marker));
     markers = [];
     if (animatedMarker) {
         map.removeLayer(animatedMarker);
         animatedMarker = null;
     }
     document.getElementById('routeInfo').innerHTML = '';
     routeInfo = null;
 }
// Event listeners
map.on('click', handleMapClick);
document.getElementById('clearRoute').addEventListener('click', clearRoute);
document.getElementById('exportRoute').addEventListener('click', exportRoute);