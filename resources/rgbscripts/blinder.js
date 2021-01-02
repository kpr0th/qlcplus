/*
  Q Light Controller Plus
  blinder.js

  Copyright (c) Hans-Jürgen Tappe

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0.txt

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

// Development tool access
var testAlgo;

(
  function()
  {
    var algo = new Object;
    algo.apiVersion = 2;
    algo.name = "Blinder";
    algo.author = "Hans-Jürgen Tappe";
    algo.acceptColors = 2;
    algo.properties = new Array();

    algo.divisor = 1;
    algo.properties.push("name:divisor|type:range|display:Divisor|values:1,30|write:setDivisor|read:getDivisor");
    
    // Prepare internal properties
    algo.size = 0;
    algo.width = 0;
    algo.height = 0;
    
    var util = new Object;
    algo.initialized = false;

    algo.setDivisor = function(_divisor)
    {
      algo.divisor = _divisor;
    };

    algo.getDivisor = function()
    {
      return algo.divisor;
    };

    // Combine RGB color from color channels
    function mergeRgb(r, g, b) {
      r = Math.min(255, Math.round(r));
      g = Math.min(255, Math.round(g));
      b = Math.min(255, Math.round(b));
      return ((r << 16) + (g << 8) + b);
    }
    
    function getColor(r, g, b, mRgb) {
      // split rgb in to components
      var pointr = (mRgb >> 16) & 0x00FF;
      var pointg = (mRgb >> 8) & 0x00FF;
      var pointb = mRgb & 0x00FF;
      // add the color to the mapped location
      pointr += r;
      pointg += g;
      pointb += b;
      // set mapped point
      return mergeRgb(pointr, pointg, pointb);
    }

    util.initialize = function(width, height)
    {
      algo.width = width;
      algo.height = height;
      var numX = 0;
      var numY = 0;
      if (width > height) {
        algo.size = width / algo.divisor;
        numX = algo.divisor;
        numY = Math.floor(height / algo.size);
      } else {
        algo.size = height / algo.divisor;
        numX = Math.floor(width / algo.size);
        numY = algo.divisor;
      }
      
      algo.bulb = new Array();

      var count = 0;
      for (var w = 0; w < numX; w++) {
        for (var h = 0; h < numY; h++) {
          algo.bulb[count] = {
            // width / algo.numX * w + width / algo.numX / 2
            x: (2 * w + 1 ) * width / 2 / numX - 0.5,
            y: (2 * h + 1 ) * height / 2 / numY - 0.5,
          };
          count ++;
        }
      }

      algo.initialized = true;
      return;
    };

    algo.rgbMap = function(width, height, rgb, progstep)
    {
      if (algo.initialized === false || width !== algo.width || algo.height !== algo.height) {
        util.initialize(width, height);
      }

      // Clear map data
      var map = new Array(height);
      for (var y = 0; y < height; y++) {
        map[y] = new Array();
        for (var x = 0; x < width; x++) {
          map[y][x] = 0;
        }
      }

      var r = (rgb >> 16) & 0x00FF;
      var g = (rgb >> 8) & 0x00FF;
      var b = rgb & 0x00FF;
      
      var stepPercent =  progstep / (algo.rgbMapStepCount(width, height) - 1);

      var bgPower = Math.pow(stepPercent + 0.1, 2);
      var bgFactor = Math.min(1, bgPower);

      // Calculate color pixel related to their positions
      var bgPointr = r * bgFactor;
      var bgPointg = g * bgFactor;
      var bgPointb = b * bgFactor;

      // for each bulb displayed
      for (var i = 0; i < algo.bulb.length; i++) {
        var xMin = Math.floor(algo.bulb[i].x - algo.size / 2) - 1;
        var xMax = Math.ceil(algo.bulb[i].x + algo.size / 2) - 1;
        var yMin = Math.floor(algo.bulb[i].y - algo.size / 2) - 1;
        var yMax = Math.ceil(algo.bulb[i].y + algo.size / 2) - 1;

        for (var ry = yMin; ry <= yMax; ry++) {
          for (var rx = xMin; rx <= xMax; rx++) {
            // Draw only if edges are on the map
            if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
              // Draw the box for debugging.
              //map[ry][rx] = getColor(40, 40, 40, map[ry][rx]);

              // calculate the offset difference of map location to the float
              // location of the tree
              var offx = Math.abs((rx - algo.bulb[i].x) / (algo.size / 2));
              var offy = Math.abs((ry - algo.bulb[i].y) / (algo.size / 2));

              // Try at: www.geogebra.org/3d
              // f(x,y) = 4 sin(π/2 * sqrt(1 - x^2 - y^2)) 
              //        + 6 cos(π/2 * sqrt(1 - x^2 - y^2)) 
              //        - sqrt((4 * x)^2 + (4 * y)^2)
              //        - 3
              // + relative step

              var s = 1 - offx * offx - offy * offy;
              if (s > 0) {
                var aFactor = 4 * Math.sin(Math.PI / 2 * Math.sqrt(1 - offx * offx - offy * offy));
                var bFactor = 6 * Math.cos(Math.PI / 2 * Math.sqrt(1 - offx * offx - offy * offy));
                var cFactor = Math.sqrt(4 * offx * 4 * offx + 4 * offy * 4 * offy);
  
                var factor = aFactor
                  + bFactor
                  - cFactor
                  - 3
                  + stepPercent;
              
                if (factor < 0) {
                  factor = 0;
                }

                // Calculate color pixel related to their positions
                var pointr = r * factor;
                var pointg = g * factor;
                var pointb = b * factor;
  
                // add the bulb color to the mapped location
                map[ry][rx] = getColor(pointr, pointg, pointb, map[ry][rx]);
              }
            }
          }
        }
      }
      for (var ry = 0; ry < height; ry++) {
        for (var rx = 0; rx < width; rx++) {
          if (map[ry][rx] === 0) {
            map[ry][rx] = getColor(bgPointr, bgPointg, bgPointb, map[ry][rx]);
          }
        }
      }

      return map;
    };

    algo.rgbMapStepCount = function(width, height)
    {
      return 20; // This make no diferance to the script ;-)
    };

    // Development tool access
    testAlgo = algo;

    return algo;
  }
)();
