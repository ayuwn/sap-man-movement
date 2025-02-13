sap.ui.define([], function () {
    "use strict";
    return {
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
        formatEmpName: function (e, t) {
            if (sap.ui.Device.system.desktop && t) {
                if (t && t !== "00000000") {
                    return e + " (" + t + ")";
                }
            }
            return e;
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
        getEmployeeInitial: function (e) {
            var t = e.split(" ");
            if (t.length > 1) {
                t = t.shift().charAt(0) + t.shift().charAt(0);
                t.toUpperCase();
            } else {
                t =
                    e.substring(0, 1).toUpperCase() +
                    e.substring(1, 2).toLowerCase();
            }
            return t;
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
        }
    };
});
