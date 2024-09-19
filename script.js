// Constants
const DEFAULT_VIEW = [0.0236, 37.9062];
const DEFAULT_ZOOM = 7;
const TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MARKER_ICON_URL = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const MARKER_SHADOW_URL = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

// Transport mode speeds (km/h)
const SPEEDS = {
    car: 80,
    motorcycle: 100,
    foot: 15,
    public_transport: 50
};

class RoutingApp {
    constructor() {
        this.map = L.map('map').setView(DEFAULT_VIEW, DEFAULT_ZOOM);
        this.routingControl = null;
        this.markers = [];
        this.waypoints = [];
        this.routeOptions = [];
        this.routeInfo = null;
        this.currentSpeed = SPEEDS.car; // Default speed

        this.initializeMap();
        this.setupEventListeners();
    }

    initializeMap() {
        L.tileLayer(TILE_LAYER_URL, {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.markerIcon = L.icon({
            iconUrl: MARKER_ICON_URL,
            iconSize: [12, 20],
            iconAnchor: [9, 12],
            popupAnchor: [1, -34],
            shadowUrl: MARKER_SHADOW_URL,
            shadowSize: [15, 15]
        });
    }

    setupEventListeners() {
        this.map.on('click', this.handleMapClick.bind(this));
        document.getElementById('clearRoute').addEventListener('click', this.clearRoute.bind(this));
        document.getElementById('detectLocation').addEventListener('click', this.detectLocation.bind(this));
        document.getElementById('transportMode').addEventListener('change', this.updateSpeedAndCalculateRoute.bind(this));
        document.getElementById('exportRoute').addEventListener('click', this.handleExport.bind(this));
    }

    handleMapClick(e) {
        this.addWaypoint(e.latlng);
    }

    addWaypoint(latLng) {
        const marker = L.marker(latLng, { icon: this.markerIcon, draggable: true }).addTo(this.map);
        marker.on('dragend', this.calculateRoute.bind(this));
        this.markers.push(marker);
        this.waypoints.push(latLng);

        if (this.waypoints.length >= 2) {
            this.calculateRoute();
        }
    }

    updateSpeedAndCalculateRoute() {
        const mode = document.getElementById('transportMode').value;
        this.currentSpeed = SPEEDS[mode] || SPEEDS.car; // Update current speed based on selected mode
        this.calculateRoute();
    }

    calculateRoute() {
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
        }

        const mode = document.getElementById('transportMode').value;
        const profile = this.getProfileForMode(mode);

        this.showLoadingIndicator();

        this.routingControl = L.Routing.control({
            waypoints: this.waypoints,
            routeWhileDragging: true,
            lineOptions: {
                styles: [{ color: '#6FA1EC', weight: 4 }]
            },
            createMarker: () => null,
            router: L.Routing.osrmv1({
                profile: profile,
                serviceUrl: 'https://router.project-osrm.org/route/v1'
            }),
            routeName: 'Route'
        }).addTo(this.map);

        this.routingControl.on('routesfound', this.handleRoutesFound.bind(this));
    }

    handleRoutesFound(e) {
        this.hideLoadingIndicator();
        this.routeOptions = e.routes.slice(0, 2); // Get only the best two routes
        this.updateRouteSelect();
        this.handleRouteSelection(); // Update route info immediately
    }

    getProfileForMode(mode) {
        const profiles = {
            car: 'car',
            motorcycle: 'motorcycle',
            foot: 'foot',
            public_transport: 'public_transport'
        };
        return profiles[mode] || 'car';
    }

    updateRouteSelect() {
        const routeSelect = document.getElementById('routeSelect');
        routeSelect.innerHTML = '';

        this.routeOptions.forEach((route, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = `Route ${index + 1} (${(route.summary.totalDistance / 1000).toFixed(2)} km)`;
            routeSelect.add(option);
        });

        routeSelect.style.display = this.routeOptions.length > 0 ? 'inline' : 'none';
        routeSelect.addEventListener('change', this.handleRouteSelection.bind(this));
    }

    handleRouteSelection() {
    const selectedIndex = document.getElementById('routeSelect').value;
    const selectedRoute = this.routeOptions[selectedIndex];

    if (selectedRoute) {
        const summary = selectedRoute.summary;
        const mode = document.getElementById('transportMode').value;
        const speed = SPEEDS[mode] || SPEEDS.car;

        const distanceKm = summary.totalDistance / 1000;
        const totalMinutes = (distanceKm / speed) * 60;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);

        this.routeInfo = {
            distance: distanceKm.toFixed(2),
            time: `${hours}h ${minutes}m`,
            averageSpeed: speed,
            instructions: selectedRoute.instructions,
            coordinates: selectedRoute.coordinates
        };

        this.updateRouteInfoDisplay();
    }
}

updateRouteInfoDisplay() {
    if (this.routeInfo) {
        document.getElementById('distance').innerText = `${this.routeInfo.distance} km`;
        document.getElementById('time').innerText = this.routeInfo.time;
        document.getElementById('speed').innerText = `${this.routeInfo.averageSpeed} km/h`;
        document.getElementById('mode').innerText = document.getElementById('transportMode').value;
    }
}


    clearRoute() {
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
        }
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        this.waypoints = [];
        this.routeOptions = [];
        document.getElementById('routeSelect').innerHTML = '';
        document.getElementById('routeSelect').style.display = 'none';
        this.updateRouteInfoDisplay();
    }

    detectLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const latLng = [position.coords.latitude, position.coords.longitude];
                    this.map.setView(latLng, 13);
                    this.addWaypoint(latLng);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    alert("Unable to retrieve your location. Please try again.");
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    }

    handleExport() {
        if (!this.routeInfo || !this.routeInfo.instructions) {
            alert("Please calculate a route first.");
            return;
        }

        const format = document.getElementById('exportFormat').value;
        switch (format) {
            case 'pdf':
                this.exportRouteAsPDF();
                break;
            case 'geojson':
                this.exportRouteAsGeoJSON();
                break;
        }
    }

    exportRouteAsPDF() {
        if (!this.routeInfo || !this.routeInfo.instructions) {
            alert("Please calculate a route first.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 10;

        doc.setFontSize(16);
        doc.text('Route Information', 10, y);
        y += 10;

        doc.setFontSize(12);
        doc.text(`Total Distance: ${this.routeInfo.distance} km`, 10, y);
        y += 10;
        doc.text(`Estimated Time: ${this.routeInfo.time} minutes`, 10, y);
        y += 10;
        doc.text(`Average Speed: ${this.routeInfo.averageSpeed} km/h`, 10, y);
        y += 10;
        doc.text(`Transport Mode: ${document.getElementById('transportMode').value}`, 10, y);
        y += 10;

        doc.text('Instructions:', 10, y);
        y += 10;
        this.routeInfo.instructions.forEach(instr => {
            doc.text(`${this.getInstructionIcon(instr.type)} ${instr.text} ${instr.distance ? (instr.distance / 1000).toFixed(2) + ' km' : ''}`, 10, y);
            y += 10;
        });

        doc.save('route_information.pdf');
    }

    exportRouteAsGeoJSON() {
        if (!this.routeInfo || !this.routeInfo.instructions) {
            alert("Please calculate a route first.");
            return;
        }

        const geojson = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {
                        distance: this.routeInfo.distance,
                        time: this.routeInfo.time,
                        averageSpeed: this.routeInfo.averageSpeed,
                        transportMode: document.getElementById('transportMode').value
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: this.routeInfo.coordinates.map(coord => [coord.lng, coord.lat])
                    }
                }
            ]
        };

        this.downloadFile(JSON.stringify(geojson, null, 2), 'route.geojson', 'application/geo+json');
    }

    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    }

    getInstructionIcon(type) {
        const icons = {
            Head: '↑',
            Straight: '↑',
            TurnRight: '→',
            TurnLeft: '←',
            SlightRight: '↗',
            SlightLeft: '↖'
        };
        return icons[type] || '•';
    }

    showLoadingIndicator() {
        console.log('Loading...');
    }

    hideLoadingIndicator() {
        console.log('Loading complete');
    }
}

// Initialize the app
const app = new RoutingApp();
