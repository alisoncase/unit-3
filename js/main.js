// This script creates a D3 choropleth map of Chicago neighborhoods

// Wrap everything in a self-executing anonymous function to move to local scope
(function(){

// Pseudo-global variables
var attrArray = [
    "UnemploymentRate", 
    "HighSchoolGraduation", 
    "PovertyRate",
    "PerceivedNeighborhoodViolenceRate",
    "EaseOfWalkingToTransitStopRate",
    "PerceivedNeighborhoodCleanlinessRate",
    "FoodInsecurityRate",
    "OverallHealthStatusRate",
    "PrimaryCareProviderRate",
    "RoutineCheckupRate",
    "ReceivedNeededCareRate"
]; // List of attributes for the map and chart
var expressed = attrArray[0]; // Initial attribute displayed

// Chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

// Scale for sizing bars proportionally and for the axis
var yScale = d3.scaleLinear()
    .range([463, 0])
    .domain([0, 100]);

// Begin script when window loads
window.onload = setMap();

// Function to set up the choropleth map
function setMap(){

    // Map frame dimensions
    var width = window.innerWidth * 0.425,
        height = 600;

    // Create new SVG container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    // Create Albers equal area conic projection centered on Chicago
    var projection = d3.geoAlbers()
        .center([0, 41.835])
        .rotate([87.7, 0, 0])
        .parallels([42, 41])
        .scale(75000)
        .translate([width / 2, height / 2]);
    
    // Create path generator based on the projection
    var path = d3.geoPath()
        .projection(projection);

    // Use Promise.all to parallelize asynchronous data loading
    var promises = [];    
    promises.push(d3.csv("data/chicagoData.csv")); // Load attributes from CSV    
    promises.push(d3.json("data/Illinois_Counties.topojson")); // Load IL counties spatial data
    promises.push(d3.json("data/Indiana_Counties.topojson")); // Load IN counties spatial data     
    promises.push(d3.json("data/chicagoNeighborhoodsSimp2pct.topojson")); // Load Chicago neighborhoods spatial data
    promises.push(d3.json("data/chicagoMetroCities.topojson")); // Load cities spatial point data
    Promise.all(promises).then(function(data) {
        callback(map, path, data, projection); 
    });

    // Callback function to process data and set up the map
    function callback(map, path, data, projection) {
        var csvData = data[0],
            countiesIL = data[1],
            countiesIN = data[2],
            chicago = data[3],
            cities = data[4];

        // Debugging logs
        console.log(csvData);
        console.log(countiesIL);
        console.log(countiesIN);
        console.log(chicago);
        console.log(cities);

        // Place graticule on the map
        setGraticule(map, path);

        // Translate TopoJSON objects to GeoJSON features
        var chicagolandCounties = topojson.feature(countiesIL, countiesIL.objects.Illinois_Counties),
            indianaCounties = topojson.feature(countiesIN, countiesIN.objects.Indiana_Counties),
            chicagoNeighborhoods = topojson.feature(chicago, chicago.objects.ChicagoNeighborhoodsSimp2pct).features;

        // Examine the results in the console
        console.log(chicagolandCounties);
        console.log(indianaCounties);
        console.log(chicagoNeighborhoods);
               
        // Join CSV data to GeoJSON enumeration units
        chicagoNeighborhoods = joinData(chicagoNeighborhoods, csvData);

        // Create the color scale
        var colorScale = makeColorScale(csvData);

        // Add enumeration units to the map
        setEnumerationUnits(chicagolandCounties, indianaCounties, chicagoNeighborhoods, map, path, colorScale);

        // Add city labels to the map
        setCityLabels(cities, map, path, projection);

        // Add coordinated visualization (chart) to the map
        setChart(csvData, colorScale);

        // Add dropdown menu for attribute selection
        createDropdown(csvData);
    };
}; // End of setMap()

// Function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#f2f0f7",
        "#cbc9e2",
        "#9e9ac8",
        "#756bb1",
        "#54278f"
    ];

    // Create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    // Build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    // Cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);

    // Reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });

    // Remove first value from domain array to create class breakpoints
    domainArray.shift();

    // Assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};

// Function to create dynamic label
function setLabel(props){
    // Label content with attribute value and name
    var labelAttribute = "<h1>" + props[expressed].toFixed(2) + 
    "%</h1><b>" + expressed + "</b>";

    // Create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.community + "_label")
        .html(labelAttribute);

    // Add neighborhood name to the label
    var neighborhoodName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.community);
};

// Function to move info label with mouse
function moveLabel(event){
    // Get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    // Use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 2,
        y1 = event.clientY - 2,
        x2 = event.clientX - labelWidth - 2,
        y2 = event.clientY + 2;

    // Horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 2 ? x2 : x1; 
    // Vertical label coordinate, testing for overflow
    var y = event.clientY < 2 ? y2 : y1; 

    // Move the label to calculated coordinates
    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};

// Function to highlight enumeration units and bars
function highlight(props){
    // Change stroke to highlight feature
    var selected = d3.selectAll("." + props.community)
        .style("stroke", "black")
        .style("stroke-width", "2");
    // Show the information label
    setLabel(props);
};

// Function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.community)
        // Reset stroke style using original values
        .style("stroke", function(){
            return getStyle(this, "stroke");
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width");
        });

    // Function to get original style from <desc> element
    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    // Remove info label
    d3.select(".infolabel").remove();
};

// Function to set graticule lines on the map
function setGraticule(map, path){
    // Create graticule generator
    var graticule = d3.geoGraticule()
        .step([5, 5]); // Place graticule lines every 5 degrees

    // Create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) // Bind graticule background
        .attr("class", "gratBackground") // Assign class for styling
        .attr("d", path); // Project graticule

    // Create graticule lines
    var gratLines = map.selectAll(".gratLines")
        .data(graticule.lines()) // Bind graticule lines
        .enter()
        .append("path")
        .attr("class", "gratLines") // Assign class for styling
        .attr("d", path); // Project graticule lines
};

// Function to join CSV data to GeoJSON features
function joinData(chicagoNeighborhoods, csvData){
    // Loop through CSV to assign each set of CSV attribute values to GeoJSON region
    for (var i=0; i<csvData.length; i++){
        var csvNeighborhood = csvData[i]; // The current neighborhood
        var csvKey = csvNeighborhood.community.toUpperCase(); // CSV primary key in uppercase

        // Loop through GeoJSON regions to find matching region
        for (var a=0; a<chicagoNeighborhoods.length; a++){

            var geojsonProps = chicagoNeighborhoods[a].properties; // GeoJSON properties
            var geojsonKey = geojsonProps.community; // GeoJSON primary key

            // Where primary keys match, transfer CSV data to GeoJSON properties object
            if (geojsonKey == csvKey){  
                // Assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvNeighborhood[attr]); // Get CSV attribute value
                    geojsonProps[attr] = val; // Assign attribute and value to GeoJSON properties
                });
            };
        };
    }
    return chicagoNeighborhoods;
};
 
// Function to add enumeration units to the map
function setEnumerationUnits(chicagolandCounties, indianaCounties, chicagoNeighborhoods, map, path, colorScale){
    // Add Chicago metro IL counties to map
    var ilCounties = map.append("path")
        .datum(chicagolandCounties)
        .attr("class", "counties")
        .attr("d", path);

    // Add Indiana's Lake County to map
    var inCounties = map.append("path")
        .datum(indianaCounties)
        .attr("class", "countiesIN")
        .attr("d", path);
   
    // Add Chicago neighborhoods to map
    var communities = map.selectAll(".communities")
        .data(chicagoNeighborhoods)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "communities " + d.properties.community;
        })
        .attr("d", path)
        .style("fill", function(d){
            // Style fill based on data value
            var value = d.properties[expressed];
            if(value) {
                return colorScale(d.properties[expressed]);
            } else {
                console.warn("Missing or invalid value for:", d.properties.community);
                return "#ccc";
            }               
        })
        // Add interactivity
        .on("mouseover", function(event, d){
            highlight(d.properties);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    // Append description for original styles
    var desc = communities.append("desc")
        .text('{"stroke": "#969696", "stroke-width": "1.5px"}');
};

// Function to add city labels to the map
function setCityLabels(cities, map, path, projection){
    // Add labels for Chicago area cities to map
    var metroCities = map.selectAll(".city-point")
        .data(topojson.feature(cities, cities.objects.pasted).features)
        .enter()
        .append("g")
        .attr("class", "city-group");
    
    // Add circle points for city labels 
    metroCities.append("circle")
        .attr("class", "city-point")
        .attr("cx", function(d) { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", function(d) { return projection(d.geometry.coordinates)[1]; })
        .attr("r", 3)
        .attr("fill", "grey");
    
    // Add text for city labels
    metroCities.append("text")
        .attr("class", function(d) {
            return "place-label " + (d.properties.City === "Chicago" ? "chicago-label" : "");
        }) // Create special label for Chicago
        .attr("x", function(d) {
            // Adjust the horizontal offset from circle
            return d.geometry.coordinates[0] > -87.7 ? projection(d.geometry.coordinates)[0] + 5 : projection(d.geometry.coordinates)[0] - 5;
        })
        .attr("y", function(d) { return projection(d.geometry.coordinates)[1] + 7; }) // Adjust the vertical offset from circle
        .attr("dy", ".35em")
        .style("text-anchor", function(d) {
            return d.geometry.coordinates[0] > -87.7 ? "start" : "end";
        })
        .text(function(d) { return d.properties.City; });
};

// Function to create coordinated bar chart
function setChart(csvData, colorScale){
    // Chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    // Create a second SVG element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    // Create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    // Create a scale to size bars proportionally and for axis
    var yScale = d3.scaleLinear()
        .range([463, 0])
        .domain([0, 100]);

    // Set bars for each neighborhood
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed];
        })
        .attr("class", function(d){
            return "bar " + d.community;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        // Add interactivity
        .on("mouseover", function(event, d){
            highlight(d);
        })
        .on("mouseout", function(event, d){
            dehighlight(d);
        })
        .on("mousemove", moveLabel);

    // Append description for original styles
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

    // Create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text(`${expressed.replace(/([a-z])([A-Z])/g, '$1 $2')} in each Neighborhood`);
    
    // Create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    // Place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    // Create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    // Set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
};

// Function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    // Add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData);
        });

    // Add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    // Add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d; })
        .text(function(d){ return d; });
};

// Dropdown change event handler
function changeAttribute(attribute, csvData) {
    // Change the expressed attribute
    expressed = attribute;

    // Recreate the color scale
    var colorScale = makeColorScale(csvData);

    // Recolor enumeration units
    var neighborhoodsRecolor = d3.selectAll(".communities")
        .transition()
        .duration(1000)
        .style("fill", function (d) {
            var value = d.properties[expressed];
            if (value) {
                return colorScale(d.properties[expressed]);
            } else {
                return "#ccc";
            }
        });
    
    // Sort bars
    var bars = d3.selectAll(".bar")
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() // Add animation
        .delay(function(d, i){
            return i * 20;
        })
        .duration(500);

    // Update chart with new attribute values
    updateChart(bars, csvData.length, colorScale);
};

// Function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    // Position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        // Size/resizes bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        // Color/recolor bars
        .style("fill", function(d){            
            var value = d[expressed];            
            if(value) {                
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }    
        });
    // Update chart title
    var chartTitle = d3.select(".chartTitle")
        .text(`${expressed.replace(/([a-z])([A-Z])/g, '$1 $2')} in each Neighborhood`);
};

})(); // End of self-executing anonymous function