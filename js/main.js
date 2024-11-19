// This script creates a D3 choropleth map of Chicago neighborhoods

//Wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["UnemploymentRate", 
    "HighSchoolGraduation", 
    "PovertyRate",
    "PerceivedNeighborhoodViolenceRate",
    "EaseOfWalkingToTransitStopRate",
    "PerceivedNeighborhoodCleanlinessRate",
    "FoodInsecurityRate",
    "OverallHealthStatusRate",
    "PrimaryCareProviderRate",
    "RoutineCheckupRate",
    "ReceivedNeededCareRate"]; // list of attributes
var expressed = attrArray[0]; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

// create a scale to size bars proportionally to frame and for axis
var yScale = d3.scaleLinear()
    .range([463, 0])
    .domain([0, 100]);

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.425,
    height = 600;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on Chicago
    var projection = d3.geoAlbers()
        .center([0, 41.835])
        .rotate([87.7, 0, 0])
        .parallels([42, 41])
        .scale(75000)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
    .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];    
    promises.push(d3.csv("data/chicagoData.csv")); //load attributes from csv    
    promises.push(d3.json("data/Illinois_Counties.topojson")); //load background IL spatial data
    promises.push(d3.json("data/Indiana_Counties.topojson")); //load background IN spatial data     
    promises.push(d3.json("data/chicagoNeighborhoodsSimp2pct.topojson")); //load choropleth spatial data
    promises.push(d3.json("data/chicagoMetroCities.topojson")); //load background spatial point data
    Promise.all(promises).then(function(data) {
        callback(map, path, data, projection); 
    });

    // Set up callback function
    function callback(map, path, data, projection) {
        var csvData = data[0],
            countiesIL = data[1],
            countiesIN = data[2],
            chicago = data[3],
            cities = data[4];
        console.log(csvData);
        console.log(countiesIL);
        console.log(countiesIN);
        console.log(chicago);
        console.log(cities);

        //place graticule on the map
        setGraticule(map, path);

        //translate TopoJSON polygons
            var chicagolandCounties = topojson.feature(countiesIL, countiesIL.objects.Illinois_Counties),
            indianaCounties = topojson.feature(countiesIN, countiesIN.objects.Indiana_Counties),
            chicagoNeighborhoods = topojson.feature(chicago, chicago.objects.ChicagoNeighborhoodsSimp2pct).features;
        //examine the results
        console.log(chicagolandCounties)
        console.log(indianaCounties)
        console.log(chicagoNeighborhoods);
               
        //join csv data to GeoJSON enumeration units
        chicagoNeighborhoods = joinData(chicagoNeighborhoods, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(chicagolandCounties, indianaCounties, chicagoNeighborhoods, map, path, colorScale);

        //add cities to the map
        setCityLabels(cities, map, path, projection);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        //add dropdown menu for attribute selection
        createDropdown(csvData);
    };
}; //end of setMap()

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#f2f0f7",
        "#cbc9e2",
        "#9e9ac8",
        "#756bb1",
        "#54278f"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed].toFixed(2) + 
    "%</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.community + "_label")
        .html(labelAttribute);

    var neighborhoodName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.community);
};

//function to move info label with mouse
function moveLabel(event){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 2,
        y1 = event.clientY - 2,
        x2 = event.clientX - labelWidth - 2,
        y2 = event.clientY + 2;

    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 2 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 2 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.community)
        .style("stroke", "black")
        .style("stroke-width", "2");
    setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.community)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    //remove info label
    d3.select(".infolabel")
    .remove();
};

function setGraticule(map, path){
    //create graticule generator
    var graticule = d3.geoGraticule()
    .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(chicagoNeighborhoods, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvNeighborhood = csvData[i]; //the current Chicago neighborhood
        var csvKey = csvNeighborhood.community.toUpperCase(); //the CSV primary key converted to upper case to match geojson

        //loop through geojson regions to find correct region
        for (var a=0; a<chicagoNeighborhoods.length; a++){

            var geojsonProps = chicagoNeighborhoods[a].properties; //the current neighborhood geojson properties
            var geojsonKey = geojsonProps.community; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){  
                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvNeighborhood[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    }
    return chicagoNeighborhoods
};
 
function setEnumerationUnits(chicagolandCounties, indianaCounties, chicagoNeighborhoods, map, path, colorScale){
    //add Chicago metro IL counties to map
    var ilCounties = map.append("path")
        .datum(chicagolandCounties)
        .attr("class", "counties")
        .attr("d", path);

    //add Indiana's Lake County to map
    var inCounties = map.append("path")
        .datum(indianaCounties)
        .attr("class", "countiesIN")
        .attr("d", path);
   
    //add Chicago neighborhoods to map
    var communities = map.selectAll(".communities")
        .data(chicagoNeighborhoods)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "communities" + d.properties.community;})
        .attr("d", path)
        .style("fill", function(d){
            var value = d.properties[expressed];
            if(value) {
                return colorScale(d.properties[expressed]);
            } else {
                console.warn("Missing or invalid value for:", d.properties.community)
                return "#ccc";
            }               
        })
        .on("mouseover", function(event, d){
            highlight(d.properties);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);
    var desc = communities.append("desc")
        .text('{"stroke": "#969696", "stroke-width": "1.5px"}');
};

function setCityLabels(cities, map, path, projection){
       //add labels for Chicago area cities to map
       var metroCities = map.selectAll(".city-point")
       .data(topojson.feature(cities, cities.objects.pasted).features)
       .enter()
       .append("g")
       .attr("class", "city-group");
     
       //add circle points for city labels 
       metroCities.append("circle")
       .attr("class", "city-point")
       .attr("cx", function(d) { return projection(d.geometry.coordinates)[0]; })
       .attr("cy", function(d) { return projection(d.geometry.coordinates)[1]; })
       .attr("r", 3)
       .attr("fill", "grey");
     
       //add text for city labels
       metroCities.append("text")
       .attr("class", "place-label")
       .attr("class", function(d) {
        return "place-label " + (d.properties.City === "Chicago" ? "chicago-label" : "");
        }) // Create special label for Chicago
       .attr("x", function(d) {
         return d.geometry.coordinates[0] > -87.7 ? projection(d.geometry.coordinates)[0] + 5 : projection(d.geometry.coordinates)[0] - 5;
       }) // Adjust the horizontal offset from circle
       .attr("y", function(d) { return projection(d.geometry.coordinates)[1] + 7; }) // Adjust the vertical offset from circle
       .attr("dy", ".35em")
       .style("text-anchor", function(d) {
         return d.geometry.coordinates[0] > -87.7 ? "start" : "end";
       })
       .text(function(d) { return d.properties.City; });
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([463, 0])
        .domain([0, 100]);

    //set bars for each neighborhood
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.community;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", function(event, d){
            highlight(d);
        })
        .on("mouseout", function(event, d){
            dehighlight(d);
        })
        .on("mousemove", moveLabel);
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text(`${expressed.replace(/([a-z])([A-Z])/g, '$1 $2')} in each Neighborhood`);
    
    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};

//dropdown change event handler
function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
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
    
    //Sort bars
    var bars = d3.selectAll(".bar")
      //Sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);

    updateChart(bars, csvData.length, colorScale);
};

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){            
            var value = d[expressed];            
            if(value) {                
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }    
    });
    //add text to chart title
    var chartTitle = d3.select(".chartTitle")
        .text(`${expressed.replace(/([a-z])([A-Z])/g, '$1 $2')} in each Neighborhood`);
};

})();