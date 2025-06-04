sap.ui.define([], function () {
    "use strict";
    return {

        paramCountFormatter: function (value) {
            if (!value || isNaN(value)) {
                return "0"; // Default to 0 if the value is undefined or not a number
            }
            return value.toString(); // Convert the number to a string
        },

        asTextFormatter: function (key, asColl) {
            if (!key || !asColl) {
                return ""; // Return an empty string if key or collection is undefined
            }
        
            // Find the corresponding text for the key
            const item = asColl.find(entry => entry.key === key);
            return item ? item.text : ""; // Return the text or an empty string if not found
        },

        formatStatus: function (s) {
            switch (s) {
                case "D":
                case "V":
                case "S":
                    return sap.ui.core.ValueState.Warning;
                case "R":
                    return sap.ui.core.ValueState.Error;
                case "Posted":
                    return sap.ui.core.ValueState.Success;
                default:
                    return sap.ui.core.ValueState.Success;
            }
        },

        isTunjanganInputEnabled: function(bIsTunjanganEnabled, bIsTunjanganEditable) {
            return !!bIsTunjanganEnabled && !!bIsTunjanganEditable;
        },  

        // fallbackValue: function(selected, fallback) {
        //     // Use selected if not empty/null/undefined, else fallback
        //     return selected ? selected : fallback;
        // },

        fallbackValue: function(selected, fallback) {
            return (selected !== null && selected !== undefined && selected !== "") ? selected : fallback;
        },

        displayPositionOrPlans: function(sActionType, sPlansDesc, sPositionName) {
            if (sActionType === "ZB") {
                console.log("PositionName; ", sPositionName);
                return sPositionName;
            }
            return sPlansDesc;
        },

        removeLeadingZeros: function (sValue) {
            if (!sValue) {
                return sValue; // Return the original value if it's null or undefined
            }
            return parseInt(sValue, 10).toString(); // Convert to integer and back to string to remove leading zeros
        },

        getFileTypeIcon: function (sFileType) {
            switch (sFileType) {
                case "application/pdf":
                    return "sap-icon://pdf-attachment";
                case "image/png":
                case "image/jpeg":
                    return "sap-icon://picture";
                case "application/vnd.ms-excel":
                case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                    return "sap-icon://excel-attachment";
                case "application/msword":
                case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                    return "sap-icon://doc-attachment";
                case "text/plain":
                    return "sap-icon://document-text";
                default:
                    return "sap-icon://document";
            }
        },

        onStatus: function (sVal) {
            const oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            switch (sVal) {
                case "O":
                    return oBundle.getText("labelo");
                case "A":
                    return oBundle.getText("labela");
                case "X":
                    return oBundle.getText("labelx");
                case "W":
                    return oBundle.getText("labelw");
                case "P":
                    return oBundle.getText("labelp");
                default:
                    return oBundle.getText("labelo");
            }
        },

        onState(sVal) {
            let VS = lib.ValueState;
            switch (sVal) {
                case "O":
                    return VS.Information;
                case "A":
                    return VS.Success;
                case "P":
                    return VS.Success;
                case "X":
                    return VS.Error;
                case "W":
                    return VS.Warning;
                default:
                    return VS.Information;
            }
        },

        salaryTextFormatter: function (key, salaryAdjColl) {
            if (!key || !salaryAdjColl) {
                return ""; // Return an empty string if key or collection is undefined
            }
        
            // Find the corresponding text for the key
            const item = salaryAdjColl.find(entry => entry.key === key);
            return item ? item.text : ""; // Return the text or an empty string if not found
        },
        getBoxStyleClass: function (e) {
            switch (e) {
                default:
                    return "styleBoxGrey";
                case "32":
                case "23":
                    return "styleBoxYellow";
                case "33":
                    return "styleBoxGreen";
                case "22":
                    return "styleBoxBlue";
                case "11":
                    return "styleBoxRed";
                case "y1":
                case "y2":
                case "y3":
                case "x1":
                case "x2":
                case "x3":
                    return "styleBoxLabel";
                case "xy":
                    return "styleCircle";
                case "a1":
                    if (sap.ui.Device.system.phone) {
                        return "styleYArrowPhone";
                    } else {
                        return "styleYArrow";
                    }
                    break;
                case "a2":
                    if (sap.ui.Device.system.phone) {
                        return "styleXArrowPhone";
                    } else {
                        return "styleXArrow";
                    }
                    break;
            }
        },
        getTalentClassState: function (e) {
            switch (e) {
                default:
                    return "None";
                case "1":
                    return "Indication02";
                case "5":
                    return "Indication05";
                case "7":
                case "8":
                    return "Indication03";
                case "9":
                    return "Indication04";
            }
        },
        getPoolState: function (e) {
            switch (e) {
                default:
                    return "None";
                case "1":
                    return "Success";
                case "2":
                    return "Warning";
            }
        },
        getAssStatusState: function (e) {
            switch (e) {
                default:
                    return "Warning";
                case "Posted":
                case "Submitted":
                    return "Success";
            }
        },
        formatTextWithBrackets: function (e, t) {
            if (t) {
                return e + " (" + t + ")";
            }
            return e;
        },
        formatBoxTitle: function (e, t) {
            return "Total " + e + " Employee Selected : " + t;
        },
        formatClass: function (e, t) {
            if (t) {
                var r = "Calibrated ";
            } else {
                r = "";
            }
            if (e) {
                return r + "Talent Class (" + e + ")";
            }
            return r + "Talent Class";
        },
        formatPool: function (e) {
            if (e) {
                return "Talent Pool (" + e + ")";
            }
            return "Talent Pool";
        },
        formatTextWithDash: function (e, t) {
            if (t instanceof Date && !isNaN(t.valueOf())) {
                var r = t.getFullYear();
            } else {
                r = t;
            }
            if (r) {
                return r + " - " + e;
            }
            return e;
        },
        // formatEmpName: function (e, t) {
        //     if (sap.ui.Device.system.desktop && t) {
        //         if (t && t !== "00000000") {
        //             return e + " (" + t + ")";
        //         }
        //     }
        //     return e;
        // },

        formatEmpName: function(sName, sId) {
            if (sName && sId) {
                return sName + ' (' + sId + ')';
            }
            return sName || sId || "";
        },

        formatAvg: function (value) {
            if (!value) {
                return ""; // Return an empty string if the value is null or undefined
            }
            return value.slice(-3); // Extract the last three characters
        },

        // formatDescPel: function (value) {
        //     if (!value) {
        //         return ""; // Return an empty string if the value is null or undefined
        //     }
        
        //     // List of words to keep lowercase unless they are the first word
        //     var lowercaseWords = ["di", "tanpa", "dan", "atau", "ke", "dari", "yang", "untuk", "pada", "dengan"];
        
        //     // Process the string
        //     return value
        //         .split(" ") // Split the string into words
        //         .map((word, index) => {
        //             // Capitalize the first word or words not in the lowercase list
        //             if (index === 0 || !lowercaseWords.includes(word.toLowerCase())) {
        //                 return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        //             }
        //             return word.toLowerCase(); // Keep lowercase words as-is
        //         })
        //         .join(" "); // Join the words back into a single string
        // },

        formatDescPel: function (value) {
            if (!value) {
                return ""; // Return an empty string if the value is null or undefined
            }
        
            // List of words to keep lowercase unless they are the first word
            var lowercaseWords = ["di", "tanpa", "dan", "atau", "ke", "dari", "yang", "untuk", "pada", "dengan"];
        
            // Regular expression to match text outside parentheses and handle words inside parentheses
            var regex = /\((.*?)\)|([^\s()]+)/g;
        
            // Process the string
            return value.replace(regex, function (match, insideParentheses, outsideParentheses) {
                // If the match is inside parentheses, process all words inside
                if (insideParentheses) {
                    return `(${insideParentheses
                        .split(" ") // Split the string inside parentheses into words
                        .map(word => {
                            // Capitalize the first letter of each word unless it's in the lowercaseWords list
                            if (!lowercaseWords.includes(word.toLowerCase())) {
                                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                            }
                            return word.toLowerCase(); // Keep lowercase words as-is
                        })
                        .join(" ") // Join the words back into a single string
                    })`;
                }
        
                // If the match is outside parentheses, process all words
                if (outsideParentheses) {
                    return outsideParentheses
                        .split(" ") // Split the string outside parentheses into words
                        .map(word => {
                            // Capitalize the first letter of each word unless it's in the lowercaseWords list
                            if (!lowercaseWords.includes(word.toLowerCase())) {
                                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                            }
                            return word.toLowerCase(); // Keep lowercase words as-is
                        })
                        .join(" "); // Join the words back into a single string
                }
        
                return match; // Return the match as-is if no processing is needed
            });
        },

        formatDisposisi: function (value) {
            console.log("formatDisposisi input:", value);
            if (value === "1") {
                return 0;
            } else if (value === "2") {
                return 1;
            }
            return -1;
        },

        // formatDisposisi: function (value) {
        //     if (value === "1") {
        //         return 0; // Index for "Rekomendasi"
        //     } else if (value === "2") {
        //         return 1; // Index for "Tidak Direkomendasikan"
        //     }
        //     return -1; // Default (no selection)
        // },

        // formatCheckboxValue: function(value) {
        //     // Handle undefined or null values
        //     if (value === undefined || value === null) {
        //         return false;
        //     }
            
        //     // Convert the string "1" to true
        //     if (value === "1") {
        //         return true;
        //     }
            
        //     // Convert the string "0" to false
        //     if (value === "0") {
        //         return false;
        //     }
            
        //     // If already a boolean, return as is
        //     if (typeof value === "boolean") {
        //         return value;
        //     }
            
        //     // For any other value, convert to boolean
        //     return value === true || value === "true";
        // },

        formatCurrencyInput: function(value) {
            var num = Number(value);
            return isNaN(num) ? 0 : num;
        },

        formatCheckboxValue: function(value) {
            console.log("formatCheckboxValue input:", value);
            if (value === undefined || value === null) {
                return false;
            }
            if (value === "1" || value === 1 || value === true || value === "true") {
                return true;
            }
            if (value === "0" || value === 0 || value === false || value === "false") {
                return false;
            }
            // Fallback for any other value
            return Boolean(value);
        },

        formatApprovalTime: function (sApprovalTime) {
            if (!sApprovalTime) {
                return ""; 
            }
        
            if (typeof sApprovalTime === "object" && sApprovalTime.ms !== undefined) {
                var iMilliseconds = sApprovalTime.ms; 
                var oDate = new Date(iMilliseconds); 
        
                var sHours = String(oDate.getUTCHours()).padStart(2, "0"); 
                var sMinutes = String(oDate.getUTCMinutes()).padStart(2, "0"); 
        
                return `${sHours}:${sMinutes}`;
            }
        
            return sApprovalTime;
        },

        formatCheckboxBIValue: function(value, checkboxValue) {
            if (!value) {
                return false;
            }
            const selectedValues = value.split(",");
            return selectedValues.includes(checkboxValue);
        },

        formatAge: function (e) {
            var t = parseInt(e.substring(0, 2), 10),
                r = parseInt(e.substring(2, 4), 10);
            if (r === 0) {
                return t.toString() + " years";
            } else if (r === 1) {
                return t.toString() + " years and " + r.toString() + " month";
            } else {
                return t.toString() + " years and " + r.toString() + " months";
            }
        },
        formatYos: function (e, t) {
            var r = parseInt(e.substring(0, 2), 10),
                n = parseInt(e.substring(2, 4), 10),
                a = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "d MMM YYYY",
                }),
                s = a.format(t);
            if (n === 0) {
                return r.toString() + " years (Join in " + s + ")";
            } else if (n === 1) {
                return (
                    r.toString() +
                    " years and " +
                    n.toString() +
                    " month (Join in " +
                    s +
                    ")"
                );
            } else {
                return (
                    r.toString() +
                    " years and " +
                    n.toString() +
                    " months (Join in " +
                    s +
                    ")"
                );
            }
        },
        formatYosPos: function (e, t) {
            var r = parseInt(e.substring(0, 2), 10),
                n = parseInt(e.substring(2, 4), 10),
                a = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "d MMM YYYY",
                }),
                s = a.format(t);
            if (n === 0) {
                return r.toString() + " years (From " + s + ")";
            } else if (n === 1) {
                return (
                    r.toString() +
                    " years and " +
                    n.toString() +
                    " month (From " +
                    s +
                    ")"
                );
            } else {
                return (
                    r.toString() +
                    " years and " +
                    n.toString() +
                    " months (From " +
                    s +
                    ")"
                );
            }
        },
        // getEmployeeInitial: function (e) {
        //     var t = e.split(" ");
        //     if (t.length > 1) {
        //         t = t.shift().charAt(0) + t.shift().charAt(0);
        //         t.toUpperCase();
        //     } else {
        //         t =
        //             e.substring(0, 1).toUpperCase() +
        //             e.substring(1, 2).toLowerCase();
        //     }
        //     return t;
        // },

        isMutasiSkalaChecked: function(value) {
            // Accepts true, 1, "1", but NOT false, 0, "0", "", null, undefined
            return value === true || value === 1 || value === "1";
        },

        // isMutasiSkalaChecked: function(value) {
        //     // Returns true if value is truthy (checked), false otherwise
        //     return !!value;
        // },

        formatStatusWithStat: function(sStatus, sStat) {
            if (sStatus === "A") {
                if (sStat === "V0" || sStat === "V1") {
                    return "Verified";
                } else {
                    return "Approved";
                }
            }
            // Fallback to your existing logic or just return sStatus
            switch (sStatus) {
                case "S":
                    return "Submitted";
                case "R":
                    return "Rejected";
                case "V":
                    return "Revised";
                case "P":
                    return "Posted";
                default:
                    return sStatus || "";
            }
        },

        statusText: function(sStatus) {
            switch (sStatus) {
                case "S":
                    return "Submitted";
                case "A":
                    return "Approved";
                case "R":
                    return "Rejected";
                case "V":
                    return "Revised";
                case "P":
                    return "Posted";
                default:
                    return sStatus || "";
            }
        },

        statusState: function(sStatus) {
            switch (sStatus) {
                case "A":
                    return "Success";   // Green
                case "S":
                    return "Success"; 
                case "P":
                    return "Success";
                case "R":
                    return "Error";     // Red
                case "V":
                    return "Warning";   // Yellow/Orange
                default:
                    return "None";
            }
        },

        isApprovalButtonEnabled: function(sStatus) {
            return !sStatus;
        },

        getEmployeeInitial: function (employeeName) {
            if (!employeeName) {
                return ""; // Return an empty string if the input is undefined or null
            }
        
            // Split the name into parts and get the initials
            const nameParts = employeeName.split(" ");
            const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join("");
            return initials;
        },
        formatEmployeePhotoUrl: function (e) {
            return (
                "/sap/opu/odata/sap/ZHCM_TLPROF_MAN_SRV/EmployeePictureSet('" +
                e +
                "')/$value"
            );
        },
        formatImageURL: function (e) {
            if (e && typeof e === "string") {
                var t = "",
                    r = document.createElement("a"),
                    n = function (e) {
                        return e.replace(new RegExp("'", "g"), "%27");
                    };
                r.href = e;
                t =
                    r.pathname.charAt(0) === "/"
                        ? r.pathname
                        : "/" + r.pathname;
                return n(t);
            }
            return "";
        },
        formatPayScale: function (e, t) {
            var r = e,
                n = t;
            if (!e) {
                r = "-";
            }
            if (!t) {
                n = "-";
            }
            return r + " / " + n;
        },
        formatToNumber: function (e) {
            return parseFloat(e);
        },
        formatEdu: function (e, t, r, n) {
            var a = n.getFullYear();
            if (r) {
                return a + " - " + e + " " + t + " & " + r;
            } else {
                return a + " - " + e + " " + t;
            }
        },
        formatDevProgram: function (e, t, r) {
            return e + " - " + t + " (" + r + ")";
        },
        formatBoxPercent: function (e, t) {
            var r = 0;
            if (t > 0) {
                r = (e / t) * 100;
                return r.toFixed(2) + "% of Total";
            }
            return "";
        },
        getColorHex: function (e) {
            switch (e) {
                default:
                    return "#000000";
                case "Good":
                case "Success":
                    return "#2B7D2B";
                case "Critical":
                case "Warning":
                    return "#E78C07";
                case "Error":
                    return "#BB0000";
                case "LightGrey":
                    return "#e6e6e6";
            }
        },
        formatIDwithDescBrackets: function (e, t) {
            if (sap.ui.Device.system.desktop && t) {
                if (t && t !== "00000000" && e !== "") {
                    return e + " (" + t + ")";
                }
                if (t && t !== "00000000") {
                    return t;
                }
            }
            return e;
        },

        formatID: function (t) {
            if (t && t !== "00000000") {
                return t;
            } else {
                return "";
            }
        },

        formatRatingIndicator: function (e) {
            return e * 1;
        },
        formatRatingIndicatorTxt: function (e) {
            e = e * 1;
            if (e > 0.5 && e <= 1.5) {
                return "Knowledge (Pengetahuan)";
            } else if (e > 1.5 && e <= 2.5) {
                return "Elementary (Aplikasi)";
            } else if (e > 2.5 && e <= 3.5) {
                return "Advance (Peningkatan)";
            } else if (e > 3.5 && e <= 4.5) {
                return "Mastery (Strategi)";
            } else if (e > 4.5 && e <= 5) {
                return "Expertise (Inovasi)";
            } else {
                return "";
            }
        },
        iconDelete: function (v) {
            if (v === "N") {
                return "sap-icon://less";
            } else {
                return "sap-icon://delete";
            }
        },

        enableWhenSpecific: function (e, s) {
            if (s === "X") {
                return e;
            } else {
                return false;
            }
        },

        enableProjectUpdate: function (e, c) {
            if (c === "4") {
                return e;
            } else {
                return false;
            }
        },
        disableWhenSpecific: function (e, s) {
            if (s === "X") {
                return false;
            } else {
                return e;
            }
        },

        skillDesc: function (id, dsc, oth) {
            if (id === "99999999") {
                return oth;
            } else {
                return dsc;
            }
        },
        widthInputSkill: function (id) {
            if (
                id === "" ||
                id === undefined ||
                id === null ||
                id === "00000000"
            ) {
                return "100%";
            } else {
                return "200px";
            }
        },
        valueInputSkill: function (id) {
            if (
                id === "" ||
                id === undefined ||
                id === null ||
                id === "00000000"
            ) {
                return "";
            } else {
                return id + "";
            }
        },
        ratingSkillValue: function (id) {
            if (id === "" || id === undefined || id === null) {
                id = 0;
            } else {
                id = 1 * id;
            }
            return id;
        },
        visibleSkillValue: function (id) {
            if (
                id === "" ||
                id === undefined ||
                id === null ||
                id === "00000000"
            ) {
                return false;
            } else {
                return true;
            }
        },
        visibleRatingSkillName: function (id) {
            if (
                id === "" ||
                id === undefined ||
                id === null ||
                id === "00000000"
            ) {
                return false;
            } else if (id === "99999999") {
                return false;
            } else {
                return true;
            }
        },
        visibleDescHintSkill: function (id) {
            if (
                id === "" ||
                id === undefined ||
                id === null ||
                id === "00000000"
            ) {
                return false;
            } else if (id === "99999999") {
                return true;
            } else {
                return true;
            }
        },
        visibleOtherSkill: function (id) {
            if (
                id === "" ||
                id === undefined ||
                id === null ||
                id === "00000000"
            ) {
                return false;
            } else if (id === "99999999") {
                return true;
            } else {
                return false;
            }
        },
        ratingSkillName: function (e) {
            if (e === "" || e === undefined || e === null) {
                e = 0;
            } else {
                e = 1 * e;
            }
            e = e * 1;
            if (e > 0.5 && e <= 1.5) {
                return "Knowledge (Pengetahuan)";
            } else if (e > 1.5 && e <= 2.5) {
                return "Elementary (Aplikasi)";
            } else if (e > 2.5 && e <= 3.5) {
                return "Advance (Peningkatan)";
            } else if (e > 3.5 && e <= 4.5) {
                return "Mastery (Strategi)";
            } else if (e > 4.5 && e <= 5) {
                return "Expertise (Inovasi)";
            } else {
                return "";
            }
        },
        ratingComplexJobDesc: function (id) {
            if (id === "" || id === undefined || id === null) {
                id = 0;
            } else {
                id = 1 * id;
            }
            switch (id) {
                case 1:
                    return "Work consist of routines and repetitives function";
                    break;
                case 2:
                    return "Completion of works requires use of specific methods and/or techniques";
                    break;
                case 3:
                    return "Completion of works requires occasionally originating new methods and/or techniques";
                    break;
                case 4:
                    return "Completion of works requires originating new methods and/or techniques or developing new idea";
                    break;
                case 5:
                    return "Completion of work requires establishing concepts, theories or programme";
                    break;
                default:
                    return "";
            }
        },
        ratingYearExpDesc: function (id) {
            if (id === "" || id === undefined || id === null) {
                id = 0;
            } else {
                id = 1 * id;
            }
            switch (id) {
                case 1:
                    return "< 1 year";
                    break;
                case 2:
                    return "1 - 3 years";
                    break;
                case 3:
                    return "3 - 5 years";
                    break;
                case 4:
                    return "5 - 8 years";
                    break;
                case 5:
                    return "> 8 years";
                    break;
                default:
                    return "";
            }
            return id;
        },
        ratingFinalScoreDesc: function (v1, v2, v3) {
            if (v1 === undefined || v1 === null) {
                v1 = 0;
            }
            if (v2 === undefined || v2 === null) {
                v2 = 0;
            }
            if (v3 === undefined || v3 === null) {
                v3 = 0;
            }
            var r = (v1 * 1 + v2 * 1 + v3 * 1) / 3;
            if (r < 3) {
                r = parseFloat(r.toFixed(2));
                return "Ready Future : 3-5 years (" + r + ")";
            } else if (r >= 3 && r < 3.5) {
                r = parseFloat(r.toFixed(2));
                return "Ready Later : 1-3 years (" + r + ")";
            } else if (r >= 3.5) {
                r = parseFloat(r.toFixed(2));
                return "Ready Now : less than a year (" + r + ")";
            } else {
                return "";
            }
        },

        formatValidity: function (b, e) {
            var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "dd/MM/YYYY",
            }),
                B = dateFormat.format(b),
                E = dateFormat.format(e);
            return B + " - " + E;
        },

        // filepath: d:\KAHF\PROJECTS\man.movement\webapp\utils\formatter.js
        getSanctionDescription: function (aFilteredAttachments) {
            if (!aFilteredAttachments || !Array.isArray(aFilteredAttachments) || aFilteredAttachments.length === 0) {
                return ""; // Default message if no attachments exist
            }

            // Return the TypeDoc of the first attachment
            const oFirstAttachment = aFilteredAttachments[0];
            return oFirstAttachment.TypeDoc || "";
        },

        formatDateDisplayEfk: function (sDate) {
            if (!sDate) {
                return "";
            }
            var oDate = new Date(sDate);
            var iDay = oDate.getDate();
            var iMonth = oDate.getMonth() + 1; // Months are zero-based
            var iYear = oDate.getFullYear();
            return (iDay < 10 ? "0" + iDay : iDay) + "/" + (iMonth < 10 ? "0" + iMonth : iMonth) + "/" + iYear;
        },

        formatDateDisplay: function (sDate) {
            if (!sDate || sDate === "0000-00-00") {
                return ""; // Return blank if the date is null, undefined, or "0000-00-00"
            }
        
            var oDate = new Date(sDate);
            var iDay = oDate.getDate();
            var iMonth = oDate.getMonth() + 1; // Months are zero-based
            var iYear = oDate.getFullYear();
        
            // Check if the date is 31/12/9999
            if (iDay === 31 && iMonth === 12 && iYear === 9999) {
                return ""; // Return blank for placeholder date
            }
        
            return (iDay < 10 ? "0" + iDay : iDay) + "/" + (iMonth < 10 ? "0" + iMonth : iMonth) + "/" + iYear;
        },

        formatCareerBand: function (sValue) {
            if (sValue === "Y") {
                return "Ya";
            }
            return "Tidak";
        },

        formatEmployeeChange: function (sValue) {
            if (sValue === "00000000") {
                return ""; 
            }
            return sValue;
        },

        formatDateUtc: function (date, m) {
            if (date) {
                var oDateFormat =
                    sap.ui.core.format.DateFormat.getDateTimeInstance({
                        pattern: "yyyy-MM-ddTHH:mm:ss",
                    }),
                    dateVal = new Date(oDateFormat.format(date));
                if (!m) {
                    dateVal.setMinutes(dateVal.getTimezoneOffset() * -1);
                } else {
                    dateVal.setMinutes(dateVal.getTimezoneOffset() * 1);
                }
                return dateVal;
            } else {
                return "1970-01-01T12:00:00";
            }
        },

        formatSalary: function (value) {
            if (!value) {
                return ""; // Return an empty string if the value is null or undefined
            }
        
            // Convert the value to a number and format it as currency
            var formattedValue = parseFloat(value).toLocaleString("id-ID", {
                minimumFractionDigits: 0, // Remove decimal places
                maximumFractionDigits: 0  // Remove decimal places
            });
        
            // Remove the "IDR" prefix if not needed
            return formattedValue.replace("IDR", "").trim();
        },
        
        typeColumnListItem: function (e) {
            if (e === true) {
                return "Navigation";
            } else {
                return "Inactive";
            }
        },

        getTickColor: function (sIcon) {
            if (sIcon === "sap-icon://sys-cancel-2") {
                return "Negative";
            }
            return "Positive";
        },

        getHeatMapColor: function (sCounter) {
            switch (sCounter) {
                case "1":
                    return "#91D050";
                case "2":
                    return "#FFC000";
                case "3":
                case "4":
                    return "#FF0101";
                default:
                    return "#D9D9D9";
            }
        },

        getAttrBarColor: function (e) {
            if (e === "" || e === undefined || e === null) {
                e = 0;
            } else {
                e = 1 * e;
            }
            if (e >= 1 && e <= 2.17) {
                return "Error";
            } else if (e > 2.18 && e <= 3.83) {
                return "Critical";
            } else if (e > 3.84 && e <= 5) {
                return "Good";
            } else {
                return "Neutral";
            }
        },

        formatFileSize: function(bytes) {
            if (bytes === undefined || bytes === null) {
                return "";
            }
            
            // Convert bytes to number if it's a string
            bytes = Number(bytes);
            
            if (isNaN(bytes)) {
                return "0 B";
            }
            
            // Use only B, KB and MB units
            if (bytes < 1024) {
                return bytes + ' B';
            } else if (bytes < 1048576) { // 1024 * 1024
                return (bytes / 1024).toFixed(2) + ' KB';
            } else {
                return (bytes / 1048576).toFixed(2) + ' MB'; 
            }
        }
    };
});
