/* Stylesheet by Alicia Wood, 2022 */ 

//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){
    
//pseudo-global variables
    
// list of attributes to show in chloropleths 
var attrArray = {"GRAD_RATE_2018_2019":"High School Graduation Rates", "STUDENTS_REL_COUNT_2020_2021": "Students Enrolled Per Teacher", "SALARY_2020_2021":"Average Teacher Salary", "EXPENDITURES_2019_2020": "Expenditures per Student", "UNDERQUALIFIED": "Underqualified Hires Per 10,000 Students"};
//list of all attributes (includes extra year field for use in the label)
var attrArrayAll = {"GRAD_RATE_2018_2019":"High School Graduation Rates", "STUDENTS_REL_COUNT_2020_2021": "Students Enrolled Per Teacher", "SALARY_2020_2021":"Average Teacher Salary", "EXPENDITURES_2019_2020": "Expenditures per Student", "UNDERQUALIFIED": "Underqualified Hires Per 10,000 Students", "UNDERQUALIFIED_YEAR": "Underqualification Data Year"};
    
var attrKeys = Object.keys(attrArray); // version of attribute fields to include in dropdown (excludes extra fields)
var attrKeysAll = Object.keys(attrArrayAll); // version of attribute fields to include in geojson (includes extra year field for label box)

var expressed = attrKeys[0];
    
//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 563
    leftPadding = 40,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    
//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
    //map frame dimensions (then swapped out to be response and use % of width)
    var width = window.innerWidth * 0.5,
        height = 550;

    //create new svg container for the map
    var map = d3.select("#main")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on continental US with separate Hawaii and Alaska insets
    var projection = d3.geoAlbersUsa()
        .scale(1050)
        .translate([width / 2, height / 2]);
    
    // create path generator with that projection, will apply it below to draw the geometries
    var path = d3.geoPath()
        .projection(projection);
    
    //altnerative functions to use below in queue to reformat and get callback working in d3 v6
    function getcsv(url, callback) {
        d3.csv(url).then(function (file){
            callback(null, file)
        })
    };
    function getjson(url, callback) {
        d3.json(url).then(function (file){
            callback(null, file)
        })
    };
    
    //use queue to parallelize asynchronous data loading
    d3.queue()
        // workaround for v5 (calls functions above)  
        .defer(getcsv,"data/EducationData.csv") //load attributes from csv
        .defer(getjson, "data/States.topojson") //load chloropleth spatial data
        .await(callback);
    
    function callback(error, csvData, statesData) {
        
        //translate US states TopoJSON
        var usStates = topojson.feature(statesData, statesData.objects.States).features;

        //join csv data to GeoJSON enumeration units
        usStates = joinData(usStates, csvData);
        
        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(usStates, map, path, colorScale);
        
        //add coordinated visualization to the map
        setChart(csvData, colorScale);
        
        //create dropdown menu in map to change the attribute displayed
        createDropdown(csvData);
        
    };
}; // end of setMap()
    
// function for adding csvData attributes to usState geojson (called in callback function)
function joinData(usStates, csvData){
    //variables to join into geojson from csv are stored in the psuedo-global variable above

    //loop through csv to assign each set of csv attribute values to geojson state
    for (var i=0; i<csvData.length; i++){
        var csvState = csvData[i]; //the current state
        var csvKey = csvState.STUSPS; //the csv primary key

        //loop through geojson states to find correct state
        for (var a=0; a<usStates.length; a++){

            var geojsonProps = usStates[a].properties; //the current state geojson properties
            var geojsonKey = geojsonProps.STUSPS; //the geojson primary key

            //where the primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){
                
                //for each attribute field assign csv value to geojson
                attrKeysAll.forEach(function(attrKey){
                    // UNDERQUALIFIED_YEAR needs to remain a string, rest convert to floats
                    if (attrKey == "UNDERQUALIFIED_YEAR"){
                        var val = csvState[attrKey]; //get csv attribute value (leave as string)
                        geojsonProps[attrKey] = val; //assign attribute and value to geojson properties
                    } else {
                        var val = parseFloat(csvState[attrKey]); //get csv attribute value (convert to float)
                        geojsonProps[attrKey] = val; //assign attribute and value to geojson properties
                    }0
                }); // end processing each attribute
            }; // end if keys match section
        }; // end states for loop
    }; // end csv for loop

    return usStates;
};
    
//function to create color scale generator (called in callback and changeAttribute functions)
function makeColorScale(data){
    //5 colors for choropleth and bar chart visuals
    var colorClasses = [
        "#A0D2E7",
        "#81B1D5",
        "#5C7EC3",
        "#26408B",
        "#0F084B"
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
    
//function to test for a data value and return color for map/chart (called in setEnumerationUnits, changeAttribute, updateChart functions)
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color (based on the color scale generator function); otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};
    
// function for adding US states to map and their initial set up (called in callback function)
function setEnumerationUnits(usStates, map, path, colorScale){
    //block for creating the states in the map and setting up mouseover functionality
    var states = map.selectAll(".states")
        .data(usStates)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "states " + d.properties.STUSPS;
        })
        .attr("d", path)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover",function(event, d){
            highlight(d.properties);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", function(event){
            moveLabel(event);
        });
    
    //add style descriptor to each path (storing prior stroke style for use in dehighlight later to return to this)
    var desc = states.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};
    
//function to create coordinated bar chart and it's initial set up (called in callback function)
function setChart(csvData, colorScale){
    
    //chart frame dimensions and scale now set as psuedo-global variables at beginning

    //create a second svg element to hold the bar chart
    var chart = d3.select("#main") 
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
    
    //set bars for each state (only width set here, height and color populated below in updateChart based on attribute value)
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.STUSPS;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover",function(event, d){
            highlight(d);
        })
        .on("mouseout",function(event, d){
            dehighlight(d);
        })
        .on("mousemove", function(event){
            moveLabel(event);
        });
    
    //add style descriptor to each rect
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    
    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 60) // only setting an initial value here... modifies this later in updateChart to use width of the title to center it
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text(attrArray[expressed]); // sets chart title based on initial default variable. will change later to match dropdown selection
    
    //get max value of attribute so can use in y scale
    var maxVal = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });
    
    //calls separate createYScale function to create a scale to size bars proportionally to frame
    var yScale = createYScale(maxVal);
    
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
    
    //set bar positions, heights, and colors based on attribute value
    updateChart(bars, csvData.length, colorScale, maxVal, chart);
};

//function to create yScale used in sizing the bars proportionally (called in setChart and updateChart functions)
function createYScale(maxVal){
    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, maxVal + 0.1*maxVal]); // used the max attribute value to inform this since all 5 variables differ drastically in range
    return yScale;
};
    
//function to create a dropdown menu for attribute selection (called in callback function)
function createDropdown(csvData){
    //get bounds of map to base placement of the dropdown menu off of later
    var mapBounds = d3.select(".map")
        .node()
        .getBoundingClientRect();
    var x = mapBounds.left + 8;
    var y = mapBounds.top + 8;
    
    //add select element for dropdown menu
    var dropdown = d3.select("#main")
        .append("select")
        .attr("class", "dropdown")
        .style("left", x + "px")
        .style("top", y + "px")
        .on("change", function(){
            changeAttribute(this.value, csvData);
        });

    //add initial option in dropdown menu
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");
    
    //add rest of attribute name options in dropdown menu
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrKeys)
        .enter()
        .append("option")
        .attr("value", function(d){ return d }) // assigns attribute value of actual field name
        .text(function(d){ return attrArray[d] }); // assigns text (what is actually displayed) of a better formatted version
};
    
//function for dropdown change listener handler (calls other functions to change attribute displayed in map and chart to match the dropdown selection) (called in createDropdown function)
function changeAttribute(attribute, csvData){
    // passed attribute the newly selected attr.value from the dropdown menu
    
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var states = d3.selectAll(".states")
        .transition()
        .duration(1500)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //selects bars and re-sorts them (resize and recoloring is completed in updateChart below)
    var bars = d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() // adds animation to highlight the data has changed
        .delay(function(d,i){
            return i * 20 // delays each bars animation by 20 milliseconds each so they look like they are moving one by one to rearrange themselves
        })
        .duration(250); // gives each bar 1/2 second to complete the transition
    
    //get max value of attribute so can use in y scale in updateChart to resize bars
    var maxVal = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });
    
    //selects chart element to pass to the updateChart function
    var chart = d3.select(".chart");
        
    //calls the updateChart function to update the position/size/color of the bars according to the new attribute
    updateChart(bars, csvData.length, colorScale, maxVal, chart);
};
    
//function to position, size, and color bars in chart (called in setChart and changeAttribute functions)
function updateChart(bars, n, colorScale, maxVal, chart){
    
    //calls separate createYScale function to create a scale to size bars proportionally to frame
    var yScale = createYScale(maxVal);
    
    //re-position and color the bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d){
            return chartInnerHeight - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
    
    //create new vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //replace axis based on new max value
    var axis = d3.select(".axis")
        .call(yAxis);

    //update chart title with new attribute name
    var chartTitle = d3.selectAll(".chartTitle")
        .text(attrArray[expressed]);
    
    //get length of updated title to use in centering
    var titleWidth = d3.select(".chartTitle")
        .node()
        .getBoundingClientRect()
        .width;
    
    //get proper x offset needed to center the chart title using the chart width and title width
    var newXposition = leftPadding + ((chartInnerWidth-titleWidth)/2)
        
    //use length to get proper x value for centering within chart window
    var chartTitle = d3.selectAll(".chartTitle")
        .attr("x",newXposition);
};
    
//function to create dynamic label whenever a user hovers over an item in the map or chart (called in highlight function)
function setLabel(props){
    
    //formatted attribute name (longer description name rather than the field name with no spaces)
    attrName = attrArray[expressed];
    
    //prep a short string for the school year source of the data to include in label popup
    if (expressed == "UNDERQUALIFIED"){
        //UNDERQUALIFIED is the only attribute where the year used changed depending on the state, so is stored in separate field
        schoolYear = " (" + props["UNDERQUALIFIED_YEAR"] + ")";
    } else {
        //the rest of the attributes the same year was used for all states and is part of the attribute name, so get from substring
        schoolYear = " (" + expressed.substr(-9,4) + "-" + expressed.substr(-4,4) + ")";
    };
    
    //modify label content depending on format of attribute ($, %, etc) and include year info above
    if (["SALARY_2020_2021","EXPENDITURES_2019_2020"].includes(expressed)){
        //csv is source for bar chart values and they are strings with decimals .00 so convert to float which removes these
        if (typeof(expressed)=== "string"){ 
            value = parseFloat(props[expressed]);
        } else { 
            value = props[expressed];
        }
        var labelAttribute = "<h1>" + "$"+ value + "</h1><b>" + attrName + schoolYear +"</b>";
        
    } else if (["GRAD_RATE_2018_2019"].includes(expressed)){
        var labelAttribute = "<h1>" + props[expressed] + "%" + "</h1><b>" + attrName + schoolYear + "</b>";
        
    } else {
        var labelAttribute = "<h1>" + props[expressed] + "</h1><b>" + attrName + schoolYear +"</b>";
    };

    //create info label div element and populate with the attribute info
    var infolabel = d3.select("#main")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.STUSPS + "_label")
        .html(labelAttribute);
    
    //add the state name to info label
    var stateName = infolabel.append("div")
        .attr("class", "labelname")
        .html("<span style=\"color: #ffa142\"><b>" + props.STATE + "</b></span>");
};
    
//function to move info label with mouse and prevent overwritting boundaries (called in setEnumerationUnits and setChart functions)
function moveLabel(event){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;
    
    // initially used clientX/Y to get locations to place label box, but this wasn't reactive if the user scrolled the page, so switched to pageX/Y
    var x1 = event.pageX + 10,
        y1 = event.pageY - 75,
        x2 = event.pageX - labelWidth - 10,
        y2 = event.pageY + 25;
    
    //horizontal label coordinate, testing for overflow
    var x = event.pageX > window.innerWidth - labelWidth - 30 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.pageY < 75 ? y2 : y1;

    //modify the infolabel placement to be be reactive to page boundaries and not overflow
    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
    
//function to highlight enumeration units and bars (called in setEnumerationUnits and setChart functions)
function highlight(props){
    //change stroke to highlight hovered over state and bar boundaries (selects by state code class ex:CA so this applies to both map and chart bar items) 
    var selected = d3.selectAll("." + props.STUSPS)
        .style("stroke", "#ffa142")
        .style("stroke-width", "3");
    
    //open an info label when state/bar is hovered over
    setLabel(props);
};

//function to reset the element style on mouseout (called in setEnumerationUnits and setChart functions)
function dehighlight(props){
    // removes previous highlighting for selected state and bar boundaries and resets to previous symbology
    var selected = d3.selectAll("." + props.STUSPS) 
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    //separate function to get the style element to reset to above
    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    
    //remove info label when no longer hovering over state
    d3.select(".infolabel")
        .remove();
};
    
})(); //last line of main.js