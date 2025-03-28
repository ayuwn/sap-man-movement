sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/suite/ui/commons/networkgraph/layout/LayeredLayout",
    "sap/suite/ui/commons/networkgraph/ActionButton",
    "sap/suite/ui/commons/networkgraph/Node",
    "sap/ui/core/Fragment",
    "sap/m/Menu",
    "sap/m/MenuItem"
], function (BaseController, formatter, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, LayeredLayout, ActionButton, Node, Fragment, Menu, MenuItem) {
    "use strict";

    return BaseController.extend("bsim.hcmapp.man.movement.controller.OrgChart", {
        formatter: formatter,

        onInit: function () {
            this._oBusy = new sap.m.BusyDialog();
            this._oView = this.getView();
            this._oModel = new JSONModel();
            this._oModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
            this._mExplored = [];

            this._currentUser()
                .then((oCurrentUser) => {
                    this._sTopSupervisor = oCurrentUser.EmployeeNumber;
                    this._mExplored.push(this._sTopSupervisor);

                    this._graph = this.byId("chart");
                    this._oModel.setSizeLimit(1000);
                    this.getView().setModel(this._oModel);

                    this._fetchData();

                    this._graph.attachEvent("beforeLayouting", function (oEvent) {
                        this._graph.preventInvalidation(true);

                        this._graph.getNodes().forEach(function (oNode) {
                            oNode.removeAllActionButtons();

                            var oActionButton = new ActionButton({
                                title: "Action",
                                icon: "sap-icon://menu2",
                                press: function (oEvent) {
                                    this._openActionMenu(oEvent, oNode);
                                }.bind(this)
                            });
                            oNode.addActionButton(oActionButton);

                            var oDetailButton = new ActionButton({
                                title: "Detail",
                                icon: "sap-icon://person-placeholder",
                                press: function (oEvent) {
                                    this._openDetail(oNode, oEvent.getParameter("buttonElement"));
                                }.bind(this)
                            });
                            oNode.addActionButton(oDetailButton);

                            // Add "Up One Level" button if it is missing and the supervisor is valid
                            if (oNode.getKey() === this._sTopSupervisor) {
                                var currentSupervisor = this._oModel.getProperty("/nodes").find(node => node.key === oNode.getKey());
                                var sSupervisor = currentSupervisor?.supervisor;

                                // Check if the supervisor is valid (not null, undefined, or 00000000)
                                if (sSupervisor && sSupervisor !== "00000000") {
                                    // Check if the "Up One Level" button is already present
                                    var bHasUpOneLevelButton = oNode.getActionButtons().some(function (oButton) {
                                        return oButton.getTitle() === "Up one level";
                                    });

                                    if (!bHasUpOneLevelButton) {
                                        var oUpOneLevelButton = new ActionButton({
                                            title: "Up one level",
                                            icon: "sap-icon://arrow-top",
                                            press: function () {
                                                console.log("Navigating up one level to supervisor:", sSupervisor);
                                                this._loadMore(sSupervisor);
                                            }.bind(this)
                                        });
                                        oNode.addActionButton(oUpOneLevelButton);
                                        console.log("Added 'Up One Level' button to node:", oNode.getKey());
                                    }
                                } else {
                                    // Log that the current supervisor is the topmost supervisor
                                    console.log("No valid supervisor found for node:", oNode.getKey(), "- This is the topmost supervisor.");
                                }
                            }
                        }, this);
                    
                        this._graph.preventInvalidation(false);
                    }.bind(this));

                    //         if (oNode.getKey() === this._sLoggedInEmployeeId) {
                    //             // var sSupervisor = this._getCustomDataValue(oNode, "supervisor");
                    //             var sSupervisor = this._oModel.getProperty("/nodes").find(node => node.key === oNode.getKey())?.supervisor;

                    //             if (sSupervisor && sSupervisor !== oNode.getKey()) {
                    //                 var oUpOneLevelButton = new ActionButton({
                    //                     title: "Up one level",
                    //                     icon: "sap-icon://arrow-top",
                    //                     press: function () {
                    //                         console.log("Navigating up one level to supervisor:", sSupervisor);
                    //                         this._loadMore(sSupervisor);
                    //                     }.bind(this)
                    //                 });
                    //                 oNode.addActionButton(oUpOneLevelButton);
                    //                 console.log("Supervisor for logged-in user", oNode.getKey(), "is:", sSupervisor);
                    //             } else {
                    //                 console.warn("No valid supervisor found for the logged-in user's node:", oNode.getKey());
                    //             }
                    //         }
                    //     }, this);

                    //     this._graph.preventInvalidation(false);
                    // }.bind(this));
                })
                .catch((error) => {
                    console.error("Error fetching current user:", error);
                    MessageBox.error("Failed to load current user details.");
                });
        },

        _currentUser: function () {
            return new Promise((resolve, reject) => {
                // Show busy indicator
                this._oBusy.open();
        
                var oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
                if (!oDataModel) {
                    console.error("OData model not available");
                    this._oBusy.close();
                    MessageBox.error("System error: OData model not available");
                    reject(new Error("OData model not available"));
                    return;
                }
        
                // Call the EmployeeDetailSet endpoint to get logged-in user details
                oDataModel.read("/EmployeeDetailSet", {
                    success: function (oData) {
                        console.log("Current user data received:", oData);
        
                        if (!oData || !oData.results || oData.results.length === 0) {
                            this._oBusy.close();
                            MessageBox.error("No user data received from server");
                            reject(new Error("No user data received from server"));
                            return;
                        }
        
                        // Get the first user from the results
                        var oCurrentUser = oData.results[0];
        
                        // Store the employee ID for later use
                        this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
                        // Create a model for current user details
                        var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                        this.getView().setModel(oCurrentUserModel, "currentUser");
        
                        this._oBusy.close();
                        resolve(oCurrentUser); // Resolve the Promise with the current user data
                    }.bind(this),
                    error: function (oError) {
                        this._oBusy.close();
                        console.error("Error fetching current user data:", oError);
                        MessageBox.error(
                            "Failed to load user details: " +
                            (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
                        );
                        reject(oError); // Reject the Promise with the error
                    }.bind(this)
                });
            });
        },

        // _currentUser: function () {
        //     // Show busy indicator
        //     this._oBusy.open();
        
        //     var oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         this._oBusy.close();
        //         MessageBox.error("System error: OData model not available");
        //         return;
        //     }

        //     // Call the EmployeeDetailSet endpoint to get logged-in user details
        //     oDataModel.read("/EmployeeDetailSet", {
        //         success: function (oData) {
        //             console.log("Current user data received:", oData);
        
        //             if (!oData || !oData.results || oData.results.length === 0) {
        //                 this._oBusy.close();
        //                 MessageBox.error("No user data received from server");
        //                 return;
        //             }
        
        //             // Get the first user from the results
        //             var oCurrentUser = oData.results[0];
        
        //             // Store the employee ID for later use
        //             this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
        //             // Create a model for current user details
        //             var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
        //             this._oView.setModel(oCurrentUserModel, "currentUser");
        
        //             this._oBusy.close();
        //         }.bind(this),
        //         error: function (oError) {
        //             this._oBusy.close();
        //             console.error("Error fetching current user data:", oError);
        //             MessageBox.error(
        //                 "Failed to load user details: " +
        //                 (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
        //             );
        //         }.bind(this)
        //     });
        // },

        // _currentUser: function () {
        //     return new Promise((resolve, reject) => {
        //         this._oBusy.open();

        //         var oDataModel = this.getOwnerComponent().getModel();

        //         if (!oDataModel) {
        //             console.error("OData model not available");
        //             this._oBusy.close();
        //             MessageBox.error("System error: OData model not available");
        //             reject(new Error("OData model not available"));
        //             return;
        //         }

        //         oDataModel.read("/EmployeeSet", {
        //             success: function (oData) {
        //                 console.log("EmployeeSet data:", oData);
        //                 if (!oData || !oData.results || oData.results.length === 0) {
        //                     this._oBusy.close();
        //                     MessageBox.error("No user data received from server");
        //                     reject(new Error("No user data received from server"));
        //                     return;
        //                 }

        //                 var oCurrentUser = oData.results.find(user => user.EmployeeNumber === "81000038");

        //                 if (!oCurrentUser) {
        //                     this._oBusy.close();
        //                     MessageBox.error("Logged-in user not found in EmployeeSet");
        //                     reject(new Error("Logged-in user not found in EmployeeSet"));
        //                     return;
        //                 }

        //                 this._sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;

        //                 var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
        //                 this.getView().setModel(oCurrentUserModel, "currentUser");

        //                 this._oBusy.close();
        //                 resolve(oCurrentUser);
        //             }.bind(this),
        //             error: function (oError) {
        //                 this._oBusy.close();
        //                 console.error("Error fetching current user data:", oError);
        //                 MessageBox.error("Failed to load user details.");
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     });
        // },

        // _fetchData: function () {
        //     var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
        //     var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        
        //     this._oBusy.open();
        
        //     var aEmployeeRequest = $.ajax({
        //         url: sEmployeeUrl,
        //         method: "GET"
        //     });
        
        //     var aRelasiRequest = $.ajax({
        //         url: sRelasiUrl,
        //         method: "GET"
        //     });
        
        //     $.when(aEmployeeRequest, aRelasiRequest)
        //         .done(function (oEmployeeData, oRelasiData) {
        //             if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
        //                 var employees = oEmployeeData[0].d.results;
        //                 var relations = oRelasiData[0].d.results;
        //                 var nodes = [];
        //                 var lines = [];
        //                 var nodeKeys = new Set();
        
        //                 // Ensure the current top supervisor is included in the nodes
        //                 var currentSupervisor = employees.find(function (employee) {
        //                     return employee.EmployeeNumber === this._sTopSupervisor;
        //                 }.bind(this));
        
        //                 if (currentSupervisor) {
        //                     nodes.push({
        //                         key: currentSupervisor.EmployeeNumber,
        //                         title: currentSupervisor.EmployeeName,
        //                         picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${currentSupervisor.EmployeeNumber}')/$value`,
        //                         description: currentSupervisor.Position,
        //                         phone: currentSupervisor.Phone,
        //                         email: currentSupervisor.Email,
        //                         location: currentSupervisor.Location,
        //                         team: currentSupervisor.TotalTeam,
        //                         supervisor: currentSupervisor.Supervisor
        //                     });
        //                     nodeKeys.add(currentSupervisor.EmployeeNumber);
        
        //                     // Debugging log for the supervisor node
        //                     console.log("Adding supervisor node:", {
        //                         EmployeeNumber: currentSupervisor.EmployeeNumber,
        //                         Supervisor: currentSupervisor.Supervisor
        //                     });
        //                 }
        
        //                 // Add direct subordinates of the current top supervisor
        //                 relations.forEach(function (relation) {
        //                     if (relation.From === this._sTopSupervisor) {
        //                         var subordinate = employees.find(function (employee) {
        //                             return employee.EmployeeNumber === relation.To;
        //                         });
        
        //                         if (subordinate && !nodeKeys.has(subordinate.EmployeeNumber)) {
        //                             nodes.push({
        //                                 key: subordinate.EmployeeNumber,
        //                                 title: subordinate.EmployeeName,
        //                                 picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${subordinate.EmployeeNumber}')/$value`,
        //                                 description: subordinate.Position,
        //                                 phone: subordinate.Phone,
        //                                 email: subordinate.Email,
        //                                 location: subordinate.Location,
        //                                 team: subordinate.TotalTeam,
        //                                 supervisor: subordinate.Supervisor
        //                             });
        //                             nodeKeys.add(subordinate.EmployeeNumber);
        
        //                             // Debugging log for each subordinate node
        //                             console.log("Adding subordinate node:", {
        //                                 EmployeeNumber: subordinate.EmployeeNumber,
        //                                 Supervisor: subordinate.Supervisor
        //                             });
        
        //                             // Add the relationship line
        //                             lines.push({
        //                                 from: relation.From,
        //                                 to: relation.To
        //                             });
        
        //                             // Debugging log for each line
        //                             console.log("Adding line:", {
        //                                 from: relation.From,
        //                                 to: relation.To
        //                             });
        //                         }
        //                     }
        //                 }.bind(this));
        
        //                 // Set nodes and lines to the model
        //                 this._oModel.setProperty("/nodes", nodes);
        //                 this._oModel.setProperty("/lines", lines);
        
        //                 // Debugging log for final data
        //                 console.log("Final nodes:", nodes);
        //                 console.log("Final lines:", lines);
        
        //                 // Add the "Up One Level" button to the new supervisor node
        //                 this._graph.getNodes().forEach(function (oNode) {
        //                     if (oNode.getKey() === this._sTopSupervisor) {
        //                         var sSupervisor = currentSupervisor.Supervisor;
        
        //                         // Check if the supervisor is valid (not null, undefined, or 00000000)
        //                         if (sSupervisor && sSupervisor !== "00000000") {
        //                             // Add the "Up One Level" button only if the supervisor exists
        //                             var oUpOneLevelButton = new ActionButton({
        //                                 title: "Up one level",
        //                                 icon: "sap-icon://arrow-top",
        //                                 press: function () {
        //                                     console.log("Navigating up one level to supervisor:", sSupervisor);
        //                                     this._loadMore(sSupervisor);
        //                                 }.bind(this)
        //                             });
        //                             oNode.addActionButton(oUpOneLevelButton);
        //                             console.log("Added 'Up One Level' button to node:", oNode.getKey());
        //                         } else {
        //                             // Log that the current supervisor is the topmost supervisor
        //                             console.log("No valid supervisor found for node:", oNode.getKey(), "- This is the topmost supervisor.");
        //                         }
        //                     }
        //                 }, this);
        //             } else {
        //                 console.error("Unexpected response format", oEmployeeData, oRelasiData);
        //             }
        //         }.bind(this))
        //         .fail(function (oError) {
        //             console.error("Error fetching data", oError);
        //         })
        //         .always(function () {
        //             this._oBusy.close();
        //         }.bind(this));
        // },

        _fetchData: function () {
            var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
            var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        
            // this._oBusy.open();
        
            var aEmployeeRequest = $.ajax({
                url: sEmployeeUrl,
                method: "GET"
            });
        
            var aRelasiRequest = $.ajax({
                url: sRelasiUrl,
                method: "GET"
            });
        
            $.when(aEmployeeRequest, aRelasiRequest)
                .done(function (oEmployeeData, oRelasiData) {
                    if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
                        var employees = oEmployeeData[0].d.results;
                        var relations = oRelasiData[0].d.results;
                        var nodes = [];
                        var lines = [];
                        var nodeKeys = new Set();
        
                        // Ensure the current top supervisor is included in the nodes
                        var currentSupervisor = employees.find(function (employee) {
                            return employee.EmployeeNumber === this._sTopSupervisor;
                        }.bind(this));
        
                        if (currentSupervisor) {
                            nodes.push({
                                key: currentSupervisor.EmployeeNumber,
                                title: currentSupervisor.EmployeeName,
                                picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${currentSupervisor.EmployeeNumber}')/$value`,
                                description: currentSupervisor.Position,
                                phone: currentSupervisor.Phone,
                                email: currentSupervisor.Email,
                                location: currentSupervisor.Location,
                                team: currentSupervisor.TotalTeam,
                                supervisor: currentSupervisor.Supervisor
                            });
                            nodeKeys.add(currentSupervisor.EmployeeNumber);
        
                            // Debugging log for the supervisor node
                            console.log("Adding supervisor node:", {
                                EmployeeNumber: currentSupervisor.EmployeeNumber,
                                Supervisor: currentSupervisor.Supervisor
                            });
                        }
        
                        // Recursive function to find all subordinates
                        var findSubordinates = function (supervisorId) {
                            relations.forEach(function (relation) {
                                if (relation.From === supervisorId) {
                                    var subordinate = employees.find(function (employee) {
                                        return employee.EmployeeNumber === relation.To;
                                    });
        
                                    if (subordinate && !nodeKeys.has(subordinate.EmployeeNumber)) {
                                        nodes.push({
                                            key: subordinate.EmployeeNumber,
                                            title: subordinate.EmployeeName,
                                            picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${subordinate.EmployeeNumber}')/$value`,
                                            description: subordinate.Position,
                                            phone: subordinate.Phone,
                                            email: subordinate.Email,
                                            location: subordinate.Location,
                                            team: subordinate.TotalTeam,
                                            supervisor: subordinate.Supervisor
                                        });
                                        nodeKeys.add(subordinate.EmployeeNumber);
        
                                        // Debugging log for each subordinate node
                                        console.log("Adding subordinate node:", {
                                            EmployeeNumber: subordinate.EmployeeNumber,
                                            Supervisor: subordinate.Supervisor
                                        });
        
                                        // Add the relationship line
                                        lines.push({
                                            from: relation.From,
                                            to: relation.To
                                        });
        
                                        // Debugging log for each line
                                        console.log("Adding line:", {
                                            from: relation.From,
                                            to: relation.To
                                        });
        
                                        // Recursively find subordinates of this subordinate
                                        findSubordinates(subordinate.EmployeeNumber);
                                    }
                                }
                            });
                        };
        
                        // Start finding all subordinates of the current top supervisor
                        findSubordinates(this._sTopSupervisor);
        
                        // Set nodes and lines to the model
                        this._oModel.setProperty("/nodes", nodes);
                        this._oModel.setProperty("/lines", lines);
        
                        // Debugging log for final data
                        console.log("Final nodes:", nodes);
                        console.log("Final lines:", lines);
        
                        // Add the "Up One Level" button to the new supervisor node
                        this._graph.getNodes().forEach(function (oNode) {
                            if (oNode.getKey() === this._sTopSupervisor) {
                                var sSupervisor = currentSupervisor.Supervisor;
                        
                                // Check if the supervisor is valid (not null, undefined, or 00000000)
                                if (sSupervisor && sSupervisor !== "00000000") {
                                    // Add the "Up One Level" button only if the supervisor exists
                                    var oUpOneLevelButton = new ActionButton({
                                        title: "Up one level",
                                        icon: "sap-icon://arrow-top",
                                        press: function () {
                                            console.log("Navigating up one level to supervisor:", sSupervisor);
                                            this._loadMore(sSupervisor);
                                        }.bind(this)
                                    });
                                    oNode.addActionButton(oUpOneLevelButton);
                                    // console.log("Added 'Up One Level' button to node:", oNode.getKey());
                                } else {
                                    // Log that the current supervisor is the topmost supervisor
                                    console.log("No valid supervisor found for node:", oNode.getKey(), "- This is the topmost supervisor.");
                                }
                            }
                        }, this);
                    } else {
                        console.error("Unexpected response format", oEmployeeData, oRelasiData);
                    }
                }.bind(this))
                .fail(function (oError) {
                    console.error("Error fetching data", oError);
                })
                .always(function () {
                    // this._oBusy.close();
                }.bind(this));
        },

        // _fetchData: function () {
        //     var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
        //     var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        
        //     this._oBusy.open();
        
        //     var aEmployeeRequest = $.ajax({
        //         url: sEmployeeUrl,
        //         method: "GET"
        //     });
        
        //     var aRelasiRequest = $.ajax({
        //         url: sRelasiUrl,
        //         method: "GET"
        //     });
        
        //     $.when(aEmployeeRequest, aRelasiRequest)
        //         .done(function (oEmployeeData, oRelasiData) {
        //             if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
        //                 var employees = oEmployeeData[0].d.results;
        //                 var relations = oRelasiData[0].d.results;
        //                 var nodes = [];
        //                 var lines = [];
        //                 var nodeKeys = new Set();
        
        //                 // Ensure the current top supervisor is included in the nodes
        //                 var currentSupervisor = employees.find(function (employee) {
        //                     return employee.EmployeeNumber === this._sTopSupervisor;
        //                 }.bind(this));
        
        //                 if (currentSupervisor) {
        //                     nodes.push({
        //                         key: currentSupervisor.EmployeeNumber,
        //                         title: currentSupervisor.EmployeeName,
        //                         picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${currentSupervisor.EmployeeNumber}')/$value`,
        //                         description: currentSupervisor.Position,
        //                         phone: currentSupervisor.Phone,
        //                         email: currentSupervisor.Email,
        //                         location: currentSupervisor.Location,
        //                         team: currentSupervisor.TotalTeam,
        //                         supervisor: currentSupervisor.Supervisor
        //                     });
        //                     nodeKeys.add(currentSupervisor.EmployeeNumber);
        
        //                     // Debugging log for the supervisor node
        //                     console.log("Adding supervisor node:", {
        //                         EmployeeNumber: currentSupervisor.EmployeeNumber,
        //                         Supervisor: currentSupervisor.Supervisor
        //                     });
        //                 }
        
        //                 // Add direct subordinates of the current top supervisor
        //                 relations.forEach(function (relation) {
        //                     if (relation.From === this._sTopSupervisor) {
        //                         var subordinate = employees.find(function (employee) {
        //                             return employee.EmployeeNumber === relation.To;
        //                         });
        
        //                         if (subordinate && !nodeKeys.has(subordinate.EmployeeNumber)) {
        //                             nodes.push({
        //                                 key: subordinate.EmployeeNumber,
        //                                 title: subordinate.EmployeeName,
        //                                 picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${subordinate.EmployeeNumber}')/$value`,
        //                                 description: subordinate.Position,
        //                                 phone: subordinate.Phone,
        //                                 email: subordinate.Email,
        //                                 location: subordinate.Location,
        //                                 team: subordinate.TotalTeam,
        //                                 supervisor: subordinate.Supervisor
        //                             });
        //                             nodeKeys.add(subordinate.EmployeeNumber);
        
        //                             // Debugging log for each subordinate node
        //                             console.log("Adding subordinate node:", {
        //                                 EmployeeNumber: subordinate.EmployeeNumber,
        //                                 Supervisor: subordinate.Supervisor
        //                             });
        
        //                             // Add the relationship line
        //                             lines.push({
        //                                 from: relation.From,
        //                                 to: relation.To
        //                             });
        
        //                             // Debugging log for each line
        //                             console.log("Adding line:", {
        //                                 from: relation.From,
        //                                 to: relation.To
        //                             });
        //                         }
        //                     }
        //                 }.bind(this));
        
        //                 // Set nodes and lines to the model
        //                 this._oModel.setProperty("/nodes", nodes);
        //                 this._oModel.setProperty("/lines", lines);
        
        //                 // Debugging log for final data
        //                 console.log("Final nodes:", nodes);
        //                 console.log("Final lines:", lines);
        
        //                 // Add the "Up One Level" button to the new supervisor node
        //                 this._graph.getNodes().forEach(function (oNode) {
        //                     if (oNode.getKey() === this._sTopSupervisor) {
        //                         var sSupervisor = currentSupervisor.Supervisor;
        
        //                         if (sSupervisor) {
        //                             var oUpOneLevelButton = new ActionButton({
        //                                 title: "Up one level",
        //                                 icon: "sap-icon://arrow-top",
        //                                 press: function () {
        //                                     console.log("Navigating up one level to supervisor:", sSupervisor);
        //                                     this._loadMore(sSupervisor);
        //                                 }.bind(this)
        //                             });
        //                             oNode.addActionButton(oUpOneLevelButton);
        //                             console.log("Added 'Up One Level' button to node:", oNode.getKey());
        //                         }
        //                     }
        //                 }, this);
        //             } else {
        //                 console.error("Unexpected response format", oEmployeeData, oRelasiData);
        //             }
        //         }.bind(this))
        //         .fail(function (oError) {
        //             console.error("Error fetching data", oError);
        //         })
        //         .always(function () {
        //             this._oBusy.close();
        //         }.bind(this));
        // },

        // _fetchData: function () {
        //     var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
        //     var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        
        //     this._oBusy.open();
        
        //     var aEmployeeRequest = $.ajax({
        //         url: sEmployeeUrl,
        //         method: "GET"
        //     });
        
        //     var aRelasiRequest = $.ajax({
        //         url: sRelasiUrl,
        //         method: "GET"
        //     });
        
        //     $.when(aEmployeeRequest, aRelasiRequest)
        //         .done(function (oEmployeeData, oRelasiData) {
        //             if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
        //                 var employees = oEmployeeData[0].d.results;
        //                 var relations = oRelasiData[0].d.results;
        //                 var nodes = [];
        //                 var lines = [];
        //                 var nodeKeys = new Set();
        
        //                 // Ensure the current top supervisor is included in the nodes
        //                 var currentSupervisor = employees.find(function (employee) {
        //                     return employee.EmployeeNumber === this._sTopSupervisor;
        //                 }.bind(this));
        
        //                 if (currentSupervisor) {
        //                     nodes.push({
        //                         key: currentSupervisor.EmployeeNumber,
        //                         title: currentSupervisor.EmployeeName,
        //                         picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${currentSupervisor.EmployeeNumber}')/$value`,
        //                         description: currentSupervisor.Position,
        //                         phone: currentSupervisor.Phone,
        //                         email: currentSupervisor.Email,
        //                         location: currentSupervisor.Location,
        //                         team: currentSupervisor.TotalTeam,
        //                         supervisor: currentSupervisor.Supervisor
        //                     });
        //                     nodeKeys.add(currentSupervisor.EmployeeNumber);
        
        //                     // Debugging log for the supervisor node
        //                     console.log("Adding supervisor node:", {
        //                         EmployeeNumber: currentSupervisor.EmployeeNumber,
        //                         Supervisor: currentSupervisor.Supervisor
        //                     });
        //                 }
        
        //                 // Add direct subordinates of the current top supervisor
        //                 relations.forEach(function (relation) {
        //                     if (relation.From === this._sTopSupervisor) {
        //                         var subordinate = employees.find(function (employee) {
        //                             return employee.EmployeeNumber === relation.To;
        //                         });
        
        //                         if (subordinate && !nodeKeys.has(subordinate.EmployeeNumber)) {
        //                             nodes.push({
        //                                 key: subordinate.EmployeeNumber,
        //                                 title: subordinate.EmployeeName,
        //                                 picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${subordinate.EmployeeNumber}')/$value`,
        //                                 description: subordinate.Position,
        //                                 phone: subordinate.Phone,
        //                                 email: subordinate.Email,
        //                                 location: subordinate.Location,
        //                                 team: subordinate.TotalTeam,
        //                                 supervisor: subordinate.Supervisor
        //                             });
        //                             nodeKeys.add(subordinate.EmployeeNumber);
        
        //                             // Debugging log for each subordinate node
        //                             console.log("Adding subordinate node:", {
        //                                 EmployeeNumber: subordinate.EmployeeNumber,
        //                                 Supervisor: subordinate.Supervisor
        //                             });
        
        //                             // Add the relationship line
        //                             lines.push({
        //                                 from: relation.From,
        //                                 to: relation.To
        //                             });
        
        //                             // Debugging log for each line
        //                             console.log("Adding line:", {
        //                                 from: relation.From,
        //                                 to: relation.To
        //                             });
        //                         }
        //                     }
        //                 }.bind(this));
        
        //                 // Set nodes and lines to the model
        //                 this._oModel.setProperty("/nodes", nodes);
        //                 this._oModel.setProperty("/lines", lines);
        
        //                 // Debugging log for final data
        //                 console.log("Final nodes:", nodes);
        //                 console.log("Final lines:", lines);
        //             } else {
        //                 console.error("Unexpected response format", oEmployeeData, oRelasiData);
        //             }
        //         }.bind(this))
        //         .fail(function (oError) {
        //             console.error("Error fetching data", oError);
        //         })
        //         .always(function () {
        //             this._oBusy.close();
        //         }.bind(this));
        // },

        // _fetchData: function () {
        //     var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
        //     var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        
        //     this._oBusy.open();
        
        //     var aEmployeeRequest = $.ajax({
        //         url: sEmployeeUrl,
        //         method: "GET"
        //     });
        
        //     var aRelasiRequest = $.ajax({
        //         url: sRelasiUrl,
        //         method: "GET"
        //     });
        
        //     $.when(aEmployeeRequest, aRelasiRequest)
        //         .done(function (oEmployeeData, oRelasiData) {
        //             if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
        //                 var employees = oEmployeeData[0].d.results;
        //                 var relations = oRelasiData[0].d.results;
        //                 var nodes = [];
        //                 var lines = [];
        //                 var nodeKeys = new Set();
        
        //                 // Filter relations to include only those relevant to the current top supervisor
        //                 var filteredRelations = relations.filter(function (relation) {
        //                     return relation.From === this._sTopSupervisor || relation.To === this._sTopSupervisor;
        //                 }.bind(this));
        
        //                 // Process employees and add nodes
        //                 employees.forEach(function (employee) {
        //                     if (employee.EmployeeNumber === this._sTopSupervisor || filteredRelations.some(function (relation) {
        //                         return relation.From === employee.EmployeeNumber || relation.To === employee.EmployeeNumber;
        //                     })) {
        //                         nodes.push({
        //                             key: employee.EmployeeNumber,
        //                             title: employee.EmployeeName,
        //                             picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${employee.EmployeeNumber}')/$value`,
        //                             description: employee.Position,
        //                             phone: employee.Phone,
        //                             email: employee.Email,
        //                             location: employee.Location,
        //                             team: employee.TotalTeam,
        //                             supervisor: employee.Supervisor // Ensure this is the EmployeeNumber
        //                         });
        //                         nodeKeys.add(employee.EmployeeNumber);
        
        //                         // Debugging log for each node
        //                         console.log("Adding node:", {
        //                             EmployeeNumber: employee.EmployeeNumber,
        //                             Supervisor: employee.Supervisor
        //                         });
        //                     }
        //                 }.bind(this));
        
        //                 // Process filtered relations and add lines
        //                 filteredRelations.forEach(function (relation) {
        //                     if (nodeKeys.has(relation.From) && nodeKeys.has(relation.To)) {
        //                         lines.push({
        //                             from: relation.From,
        //                             to: relation.To
        //                         });
        
        //                         // Debugging log for each line
        //                         console.log("Adding line:", {
        //                             from: relation.From,
        //                             to: relation.To
        //                         });
        //                     }
        //                 });
        
        //                 // Set nodes and lines to the model
        //                 this._oModel.setProperty("/nodes", nodes);
        //                 this._oModel.setProperty("/lines", lines);
        
        //                 // Debugging log for final data
        //                 console.log("Final nodes:", nodes);
        //                 console.log("Final lines:", lines);
        //             } else {
        //                 console.error("Unexpected response format", oEmployeeData, oRelasiData);
        //             }
        //         }.bind(this))
        //         .fail(function (oError) {
        //             console.error("Error fetching data", oError);
        //         })
        //         .always(function () {
        //             this._oBusy.close();
        //         }.bind(this));
        // },

        // _fetchData: function () {
        //     var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
        //     var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        
        //     this._oBusy.open();
        
        //     var aEmployeeRequest = $.ajax({
        //         url: sEmployeeUrl,
        //         method: "GET"
        //     });
        
        //     var aRelasiRequest = $.ajax({
        //         url: sRelasiUrl,
        //         method: "GET"
        //     });
        
        //     $.when(aEmployeeRequest, aRelasiRequest)
        //         .done(function (oEmployeeData, oRelasiData) {
        //             if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
        //                 var employees = oEmployeeData[0].d.results;
        //                 var relations = oRelasiData[0].d.results;
        //                 var nodes = [];
        //                 var lines = [];
        //                 var nodeKeys = new Set();
        
        //                 // Process employees and add nodes
        //                 employees.forEach(function (employee) {
        //                     if (employee.EmployeeNumber === this._sTopSupervisor || relations.some(function (relation) {
        //                         return relation.From === this._sTopSupervisor && relation.To === employee.EmployeeNumber;
        //                     }.bind(this))) {
        //                         nodes.push({
        //                             key: employee.EmployeeNumber,
        //                             title: employee.EmployeeName,
        //                             picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${employee.EmployeeNumber}')/$value`,
        //                             description: employee.Position,
        //                             phone: employee.Phone,
        //                             email: employee.Email,
        //                             location: employee.Location,
        //                             team: employee.TotalTeam,
        //                             supervisor: employee.Supervisor // Ensure this is the EmployeeNumber
        //                         });
        //                         nodeKeys.add(employee.EmployeeNumber);
        
        //                         // Debugging log for each node
        //                         console.log("Adding node:", {
        //                             EmployeeNumber: employee.EmployeeNumber,
        //                             Supervisor: employee.Supervisor
        //                         });
        //                     }
        //                 }.bind(this));
        
        //                 // Process relations and add lines
        //                 relations.forEach(function (relation) {
        //                     if (nodeKeys.has(relation.From) && nodeKeys.has(relation.To)) {
        //                         lines.push({
        //                             from: relation.From,
        //                             to: relation.To
        //                         });
        
        //                         // Debugging log for each line
        //                         console.log("Adding line:", {
        //                             from: relation.From,
        //                             to: relation.To
        //                         });
        //                     }
        //                 });
        
        //                 // Set nodes and lines to the model
        //                 this._oModel.setProperty("/nodes", nodes);
        //                 this._oModel.setProperty("/lines", lines);
        
        //                 // Debugging log for final data
        //                 console.log("Final nodes:", nodes);
        //                 console.log("Final lines:", lines);
        //             } else {
        //                 console.error("Unexpected response format", oEmployeeData, oRelasiData);
        //             }
        //         }.bind(this))
        //         .fail(function (oError) {
        //             console.error("Error fetching data", oError);
        //         })
        //         .always(function () {
        //             this._oBusy.close();
        //         }.bind(this));
        // },

        _fetchAllData: function () {
            var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
            var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        
            this._oBusy.open();
        
            var aEmployeeRequest = $.ajax({
                url: sEmployeeUrl,
                method: "GET"
            });
        
            var aRelasiRequest = $.ajax({
                url: sRelasiUrl,
                method: "GET"
            });
        
            $.when(aEmployeeRequest, aRelasiRequest)
                .done(function (oEmployeeData, oRelasiData) {
                    if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
                        var employees = oEmployeeData[0].d.results;
                        var relations = oRelasiData[0].d.results;
                        var nodes = [];
                        var lines = [];
                        var nodeKeys = new Set();
        
                        // Add all employees as nodes
                        employees.forEach(function (employee) {
                            if (!nodeKeys.has(employee.EmployeeNumber)) {
                                nodes.push({
                                    key: employee.EmployeeNumber,
                                    title: employee.EmployeeName,
                                    picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${employee.EmployeeNumber}')/$value`,
                                    description: employee.Position,
                                    phone: employee.Phone,
                                    email: employee.Email,
                                    location: employee.Location,
                                    team: employee.TotalTeam,
                                    supervisor: employee.Supervisor
                                });
                                nodeKeys.add(employee.EmployeeNumber);
        
                                // Debugging log for each node
                                console.log("Adding node:", {
                                    EmployeeNumber: employee.EmployeeNumber,
                                    Supervisor: employee.Supervisor
                                });
                            }
                        });
        
                        // Add all relations as lines
                        relations.forEach(function (relation) {
                            if (nodeKeys.has(relation.From) && nodeKeys.has(relation.To)) {
                                lines.push({
                                    from: relation.From,
                                    to: relation.To
                                });
        
                                // Debugging log for each line
                                console.log("Adding line:", {
                                    from: relation.From,
                                    to: relation.To
                                });
                            }
                        });
        
                        // Set nodes and lines to the model
                        this._oModel.setProperty("/nodes", nodes);
                        this._oModel.setProperty("/lines", lines);
        
                        // Debugging log for final data
                        console.log("Final nodes:", nodes);
                        console.log("Final lines:", lines);
                    } else {
                        console.error("Unexpected response format", oEmployeeData, oRelasiData);
                    }
                }.bind(this))
                .fail(function (oError) {
                    console.error("Error fetching data", oError);
                })
                .always(function () {
                    this._oBusy.close();
                }.bind(this));
        },

        _loadMore: function (sSupervisor) {
            if (!sSupervisor) {
                console.error("No supervisor provided for loading data.");
                return;
            }
        
            console.log("Expanding to supervisor:", sSupervisor);
        
            // Update the top supervisor
            this._sTopSupervisor = sSupervisor;
        
            // Clear the graph and fetch new data
            // this._graph.deselect();
            // this._graph.destroyAllElements();
        
            // Fetch data for the new supervisor and their subordinates
            this._fetchData();
        },

        // _loadMore: function (sSupervisor) {
        //     if (!sSupervisor) {
        //         console.error("No supervisor provided for loading data.");
        //         return;
        //     }
        
        //     console.log("Loading all data for supervisor:", sSupervisor);
        
        //     // Update the top supervisor
        //     this._sTopSupervisor = sSupervisor;
        
        //     // Clear the graph and fetch all data
        //     this._graph.deselect();
        //     this._graph.destroyAllElements();
        
        //     // Fetch all nodes and lines without filtering
        //     this._fetchAllData();
        // },

        // _loadMore: function (sSupervisor) {
        //     if (!sSupervisor) {
        //         console.error("No supervisor provided for loading data.");
        //         return;
        //     }
        
        //     console.log("Loading data for supervisor:", sSupervisor);
        
        //     // Update the top supervisor
        //     this._sTopSupervisor = sSupervisor;
        
        //     // Clear the graph and fetch new data
        //     this._graph.deselect();
        //     this._graph.destroyAllElements();
        //     this._fetchData();
        // },

        // _loadMore: function (sSupervisor) {
        //     if (!sSupervisor) {
        //         console.error("No supervisor provided for loading data.");
        //         return;
        //     }
        
        //     console.log("Loading data for supervisor:", sSupervisor);
        
        //     // Update the top supervisor and explored nodes
        //     this._sTopSupervisor = sSupervisor;
        //     if (!this._mExplored.includes(sSupervisor)) {
        //         this._mExplored.push(sSupervisor);
        //     }
        
        //     // Clear the graph and fetch new data
        //     this._graph.deselect();
        //     this._graph.destroyAllElements();
        //     this._fetchData();
        //     this._setFilter();
        // },

        // _loadMore: function (sSupervisor) {
        //     if (!sSupervisor) {
        //         console.error("No supervisor provided for loading data.");
        //         return;
        //     }

        //     console.log("Loading data for supervisor:", sSupervisor);

        //     this._sTopSupervisor = sSupervisor;
        //     if (!this._mExplored.includes(sSupervisor)) {
        //         this._mExplored.push(sSupervisor);
        //     }

        //     this._graph.deselect();
        //     this._graph.destroyAllElements();
        //     this._fetchData();
        // },

        _openDetail: function (oNode, oButton) {
            var sTeamSize = this._getCustomDataValue(oNode, "team");
            var sId = oNode.getKey();

            var oDialogModel = new JSONModel({
                icon: oNode.getImage() && oNode.getImage().getProperty("src"),
                title: oNode.getDescription(),
                id: sId,
                description: this._getCustomDataValue(oNode, "position"),
                location: this._getCustomDataValue(oNode, "location"),
                showTeam: !!sTeamSize,
                team: sTeamSize,
                email: this._getCustomDataValue(oNode, "email"),
                phone: this._getCustomDataValue(oNode, "phone")
            });

            if (!this._oDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.DetailEmployee",
                    type: "XML",
                    id: this.createId("detailEmployee"),
                    controller: this
                }).then(function (oDialog) {
                    this._oDialog = oDialog;
                    this.getView().addDependent(this._oDialog);
                    this._oDialog.setModel(oDialogModel);
                    setTimeout(function () {
                        this._oDialog.open(oButton);
                    }.bind(this), 0);
                }.bind(this));
            } else {
                this._oDialog.setModel(oDialogModel);
                setTimeout(function () {
                    this._oDialog.open(oButton);
                }.bind(this), 0);
            }
        },

        _openActionMenu: function (oEvent, oNode) {
            var oButton = oEvent.getSource();
            var oMenu = new Menu({
                items: [
                    new MenuItem({
                        text: "Status Change",
                        icon: "sap-icon://business-card",
                        press: function () {
                            this.onStatusChange(oNode);
                        }.bind(this)
                    }),
                    new MenuItem({
                        text: "Mutation",
                        icon: "sap-icon://offsite-work",
                        press: function () {
                            this.onMutation(oNode);
                        }.bind(this)
                    }),
                    new MenuItem({
                        text: "Promotion",
                        icon: "sap-icon://opportunities",
                        press: function () {
                            this.onPromotion(oNode);
                        }.bind(this)
                    }),
                    new MenuItem({
                        text: "Demotion",
                        icon: "sap-icon://company-view",
                        press: function () {
                            this.onDemotion(oNode);
                        }.bind(this)
                    }),
                    new MenuItem({
                        text: "Acting",
                        icon: "sap-icon://building",
                        press: function () {
                            this.onActing(oNode);
                        }.bind(this)
                    }),
                    new MenuItem({
                        text: "Assignment",
                        icon: "sap-icon://account",
                        press: function () {
                            this.onAssignment(oNode);
                        }.bind(this)
                    })
                ]
            });
            oMenu.openBy(oButton);
        },

        _setFilter: function () {
            var aNodesCond = [],
                aLinesCond = [];
        
            // Add conditions for nodes (supervisor and subordinates)
            var fnAddBossCondition = function (sBoss) {
                aNodesCond.push(new sap.ui.model.Filter({
                    path: "key",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sBoss
                }));
        
                aNodesCond.push(new sap.ui.model.Filter({
                    path: "supervisor",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sBoss
                }));
            };
        
            // Add conditions for lines (relationships between nodes)
            var fnAddLineCondition = function (sLine) {
                aLinesCond.push(new sap.ui.model.Filter({
                    path: "from",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sLine
                }));
        
                aLinesCond.push(new sap.ui.model.Filter({
                    path: "to",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sLine
                }));
            };
        
            // Apply conditions for the explored supervisors
            this._mExplored.forEach(function (oItem) {
                fnAddBossCondition(oItem);
                fnAddLineCondition(oItem);
            });
        
            // Apply the filters to the graph's nodes and lines
            this._graph.getBinding("nodes").filter(new sap.ui.model.Filter({
                filters: aNodesCond,
                and: false
            }));
        
            this._graph.getBinding("lines").filter(new sap.ui.model.Filter({
                filters: aLinesCond,
                and: false
            }));
        },

        _getCustomDataValue: function (oNode, sName) {
            var aItems = oNode.getCustomData().filter(function (oData) {
                return oData.getKey() === sName;
            });

            var value = aItems.length > 0 ? aItems[0].getValue() : null;
            console.log("Custom data value for", sName, "is:", value);
            return value;
        },

        onMutation: function (oNode) {
            var sEmployeeNumber = oNode.getKey();

            if (!sEmployeeNumber) {
                console.error("No Employee Number found in node data");
                return;
            }

            console.log("Navigating to mutation page with Employee Number:", sEmployeeNumber);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("mutation", {
                EmployeeNumber: sEmployeeNumber
            });
        },

        onActing: function (oNode) {
            var sEmployeeNumber = oNode.getKey();

            if (!sEmployeeNumber) {
                console.error("No Employee Number found in node data");
                return;
            }

            console.log("Navigating to acting page with Employee Number:", sEmployeeNumber);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("acting", {
                EmployeeNumber: sEmployeeNumber
            });
        },

        onStatusChange: function (oNode) {
            var sEmployeeNumber = oNode.getKey();

            if (!sEmployeeNumber) {
                console.error("No Employee Number found in node data");
                return;
            }

            console.log("Navigating to status change page with Employee Number:", sEmployeeNumber);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("statuschange", {
                EmployeeNumber: sEmployeeNumber
            });
        },

        onPromotion: function (oNode) {
            var sEmployeeNumber = oNode.getKey();

            if (!sEmployeeNumber) {
                console.error("No Employee Number found in node data");
                return;
            }

            console.log("Navigating to promotion page with Employee Number:", sEmployeeNumber);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("promotion", {
                EmployeeNumber: sEmployeeNumber
            });
        },

        onDemotion: function (oNode) {
            var sEmployeeNumber = oNode.getKey();

            if (!sEmployeeNumber) {
                console.error("No Employee Number found in node data");
                return;
            }

            console.log("Navigating to demotion page with Employee Number:", sEmployeeNumber);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("demotion", {
                EmployeeNumber: sEmployeeNumber
            });
        },

        onAssignment: function (oNode) {
            var sEmployeeNumber = oNode.getKey();

            if (!sEmployeeNumber) {
                console.error("No Employee Number found in node data");
                return;
            }

            console.log("Navigating to assignment page with Employee Number:", sEmployeeNumber);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("assignment", {
                EmployeeNumber: sEmployeeNumber
            });
        },

        onDialogClose: function () {
            if (this._oDialog) {
                this._oDialog.close();
            }
        },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("overview", {}, true);
            }
        },

        linePress: function (oEvent) {
            oEvent.bPreventDefault = true;
        },

        onExit: function () {
            if (this._pQuickView) {
                this._pQuickView.then(function (oQuickView) {
                    oQuickView.destroy();
                });
            }
            this._currentEmployee = null;
        }
    });
});