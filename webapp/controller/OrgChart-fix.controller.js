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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.OrgChart-1", {
        formatter: formatter,

        onInit: function () {
            this._oBusy = new sap.m.BusyDialog();
            // Initialize the JSON model
            this._oModel = new JSONModel();
            this._oModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
        
            this._mExplored = [];
        
            // Fetch the current user and set the starting profile dynamically
            this._currentUser()
                .then((oCurrentUser) => {
                    this._sTopSupervisor = oCurrentUser.EmployeeNumber; // Set starting profile to current user's EmployeeNumber
                    console.log("Starting profile set to current user:", this._sTopSupervisor);
                    this._mExplored.push(this._sTopSupervisor);
        
                    // Initialize the graph and fetch data
                    this._graph = this.byId("chart"); // Use the ID that matches the view
                    this._oModel.setSizeLimit(1000);
                    this.getView().setModel(this._oModel);
        
                    // Initialize the employee model
                    var oEmployeeModel = new JSONModel();
                    this.getView().setModel(oEmployeeModel, "employee");
        
                    this._fetchData();
        
                    this._graph.attachEvent("beforeLayouting", function (oEvent) {
                        this._graph.preventInvalidation(true);
                    
                        this._graph.getNodes().forEach(function (oNode) {
                            oNode.removeAllActionButtons();
                    
                            // Add Action Button
                            var oActionButton = new ActionButton({
                                title: "Action",
                                icon: "sap-icon://menu2",
                                press: function (oEvent) {
                                    this._openActionMenu(oEvent, oNode);
                                }.bind(this)
                            });
                            oNode.addActionButton(oActionButton);
                    
                            // Add Detail Button
                            var oDetailButton = new ActionButton({
                                title: "Detail",
                                icon: "sap-icon://person-placeholder",
                                press: function (oEvent) {
                                    this._openDetail(oNode, oEvent.getParameter("buttonElement"));
                                }.bind(this)
                            });
                            oNode.addActionButton(oDetailButton);
                    
                            // Add "Up One Level" Button only for the logged-in user's node
                            if (oNode.getKey() === this._sLoggedInEmployeeId) {
                                var sSupervisor = oNode.getData().supervisor; // Directly access the Supervisor field
                    
                                if (sSupervisor) {
                                    var oUpOneLevelButton = new ActionButton({
                                        title: "Up one level",
                                        icon: "sap-icon://arrow-top",
                                        press: function () {
                                            console.log("Navigating up one level to supervisor:", sSupervisor);
                                            this._loadMore(sSupervisor); // Load the supervisor's chart
                                        }.bind(this)
                                    });
                                    oNode.addActionButton(oUpOneLevelButton);
                                    console.log("Supervisor for logged-in user", oNode.getKey(), "is:", sSupervisor);
                                } else {
                                    console.warn("No supervisor found for the logged-in user's node:", oNode.getKey());
                                }
                            }
                        }, this);
                    
                        this._graph.preventInvalidation(false);
                    }.bind(this));
        
                    //         if (oNode.getKey() === this._sTopSupervisor) {
                    //             // var aSupervisors = oNode.getCustomData().filter(function (oData) {
                    //             //     return oData.getKey() === "supervisor";
                    //             // });
                    //             // console.log("Custom data for node", oNode.getKey(), ":", oNode.getCustomData());
                    //             // var sSupervisor = aSupervisors.length > 0 ? aSupervisors[0].getValue() : null;
                    //             var sSupervisor = this._getCustomDataValue(oNode, "supervisor");
        
                    //             if (sSupervisor) {
                    //                 var oUpOneLevelButton = new ActionButton({
                    //                     title: "Up one level",
                    //                     icon: "sap-icon://arrow-top",
                    //                     press: function () {
                    //                         var aSupervisors = oNode.getCustomData().filter(function (oData) {
                    //                             return oData.getKey() === "supervisor";
                    //                         });
                    //                         var sSupervisor = aSupervisors.length > 0 ? aSupervisors[0].getValue() : null;
                    
                    //                         if (sSupervisor) {
                    //                             console.log("Navigating up one level to supervisor:", sSupervisor);
                    //                             this._loadMore(sSupervisor);
                    //                             this._sTopSupervisor = sSupervisor; // Update the top supervisor
                    //                         } else {
                    //                             console.warn("No supervisor found for the current node.");
                    //                         }
                    //                     }.bind(this)
                    //                 });
                    //                 oNode.addActionButton(oUpOneLevelButton);
                    //                 console.log("Supervisor for node", oNode.getKey(), "is:", sSupervisor);
                    //             } else {
                    //                 console.warn("No supervisor found for the current node.");
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
        
                // Call the EmployeeSet endpoint to get logged-in user details
                oDataModel.read("/EmployeeSet", {
                    success: function (oData) {
                        console.log("EmployeeSet data received:", oData);
        
                        if (!oData || !oData.results || oData.results.length === 0) {
                            this._oBusy.close();
                            MessageBox.error("No user data received from server");
                            reject(new Error("No user data received from server"));
                            return;
                        }
        
                        // Filter the results to get the logged-in user (EmployeeNumber: 81000038)
                        var oCurrentUser = oData.results.find(user => user.EmployeeNumber === "81000038");
        
                        if (!oCurrentUser) {
                            this._oBusy.close();
                            MessageBox.error("Logged-in user not found in EmployeeSet");
                            reject(new Error("Logged-in user not found in EmployeeSet"));
                            return;
                        }
        
                        // Store the employee ID for later use
                        this._sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        
                        // Create a model for current user details
                        var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                        this.getView().setModel(oCurrentUserModel, "currentUser");
        
                        this._oBusy.close();
                        resolve(oCurrentUser);
                    }.bind(this),
                    error: function (oError) {
                        this._oBusy.close();
                        console.error("Error fetching current user data:", oError);
                        MessageBox.error(
                            "Failed to load user details: " +
                            (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
                        );
                        reject(oError);
                    }.bind(this)
                });
            });
        },

        _fetchData: function () {
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
                    console.log("Employee Data:", oEmployeeData);
                    console.log("Relasi Data:", oRelasiData);
        
                    if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
                        var employees = oEmployeeData[0].d.results;
                        var relations = oRelasiData[0].d.results;
                        var nodes = [];
                        var lines = [];
                        var nodeKeys = new Set();
        
                        // Ensure all nodes referenced in relations are included in the employees data
                        relations.forEach(function (relation) {
                            if (!employees.some(function (employee) {
                                return employee.EmployeeNumber === relation.From || employee.EmployeeNumber === relation.To;
                            })) {
                                console.warn("Relation references nonexistent node:", relation);
                            }
                        });
        
                        // Filter the employee data to include only the top supervisor and its subordinates
                        employees.forEach(function (employee) {
                            if (employee.EmployeeNumber === this._sTopSupervisor || relations.some(function (relation) {
                                return relation.From === this._sTopSupervisor && relation.To === employee.EmployeeNumber;
                            }.bind(this))) {
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
                            }
                            console.log("Adding node:", {
                                EmployeeNumber: employee.EmployeeNumber,
                                Supervisor: employee.Supervisor,
                                CustomData: [
                                    { key: "supervisor", value: employee.Supervisor }
                                ]
                            });
                        }.bind(this));
        
                        // Transform the relation data into lines
                        relations.forEach(function (relation) {
                            if (nodeKeys.has(relation.From) && nodeKeys.has(relation.To)) {
                                lines.push({
                                    from: relation.From,
                                    to: relation.To
                                });
                            } else {
                                console.warn("Skipping line with nonexistent node:", relation);
                            }
                        });
        
                        console.log("Nodes:", nodes);
                        console.log("Lines:", lines);
        
                        // Set nodes and lines directly to the graph model
                        this._oModel.setProperty("/nodes", nodes);
                        this._oModel.setProperty("/lines", lines);
                    } else {
                        console.error("Unexpected response format", oEmployeeData, oRelasiData);
                    }
                }.bind(this))
                .fail(function (oError) {
                    console.error("Error fetching data", oError);
                    console.error("Error details:", oError.responseText);
                })
                .always(function () {
                    this._oBusy.close();
                }.bind(this));
        },

        // _fetchData: function () {
        //     var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$expand=toEmployeePicture&$format=json";
        //     var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
        //     var oModel = this._oModel;
            
        
        //     var aEmployeeRequest = $.ajax({
        //         url: sEmployeeUrl,
        //         method: "GET"
        //     });
        
        //     var aRelasiRequest = $.ajax({
        //         url: sRelasiUrl,
        //         method: "GET"
        //     });
        
        //     $.when(aEmployeeRequest, aRelasiRequest).done(function (oEmployeeData, oRelasiData) {
        //         console.log("Employee Data:", oEmployeeData);
        //         console.log("Relasi Data:", oRelasiData);
        
        //         if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
        //             var employees = oEmployeeData[0].d.results;
        //             var relations = oRelasiData[0].d.results;
        //             var nodes = [];
        //             var lines = [];
        //             var nodeKeys = new Set();

        //             // Ensure all nodes referenced in relations are included in the employees data
        //             relations.forEach(function (relation) {
        //                 if (!employees.some(function (employee) {
        //                     return employee.EmployeeNumber === relation.From || employee.EmployeeNumber === relation.To;
        //                 })) {
        //                     console.warn("Relation references nonexistent node:", relation);
        //                 }
        //             });

        //             // Filter the employee data to include only the top supervisor and its subordinates
        //             employees.forEach(function (employee) {
        //                 if (employee.EmployeeNumber === this._sTopSupervisor || relations.some(function (relation) {
        //                     return relation.From === this._sTopSupervisor && relation.To === employee.EmployeeNumber;
        //                 }.bind(this))) {
        //                     nodes.push({
        //                         key: employee.EmployeeNumber,
        //                         title: employee.EmployeeName,
        //                         picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${employee.EmployeeNumber}')/$value`,
        //                         description: employee.Position,
        //                         phone: employee.Phone,
        //                         email: employee.Email,
        //                         location: employee.Location,
        //                         team: employee.TotalTeam,
        //                         customData: [
        //                             { key: "supervisor", value: employee.Supervisor }
        //                         ]
        //                     });
        //                     nodeKeys.add(employee.EmployeeNumber);
        //                 }
        //             }.bind(this));

        //             // Transform the employee data into nodes
        //             // employees.forEach(function (employee) {
        //             //     nodes.push({
        //             //         key: employee.EmployeeNumber,
        //             //         title: employee.EmployeeName,
        //             //         picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${employee.EmployeeNumber}')/$value`,
        //             //         description: employee.Position,
        //             //         phone: employee.Phone,
        //             //         email: employee.Email,
        //             //         location: employee.Location,
        //             //         team: employee.TotalTeam
        //             //     });
        //             //     nodeKeys.add(employee.EmployeeNumber);
        //             // });
        
        //             // Filter the employee data to include only the starting profile and its subordinates
        //             // employees.forEach(function (employee) {
        //             //     if (employee.EmployeeNumber === this._sTopSupervisor || relations.some(function (relation) {
        //             //         return relation.From === this._sTopSupervisor && relation.To === employee.EmployeeNumber;
        //             //     }.bind(this))) {
        //             //         nodes.push({
        //             //             key: employee.EmployeeNumber,
        //             //             title: employee.EmployeeName,
        //             //             picture: `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeePictureSet('${employee.EmployeeNumber}')/$value`,
        //             //             description: employee.Position,
        //             //             phone: employee.Phone,
        //             //             email: employee.Email,
        //             //             location: employee.Location,
        //             //             team: employee.TotalTeam,
        //             //             customData: [
        //             //                 { key: "supervisor", value: employee.Supervisor }
        //             //             ]
        //             //         });
        //             //         nodeKeys.add(employee.EmployeeNumber);
        //             //     }
        //             // }.bind(this));

        //             // Transform the relation data into lines
        //             relations.forEach(function (relation) {
        //                 if (nodeKeys.has(relation.From) && nodeKeys.has(relation.To)) {
        //                     lines.push({
        //                         from: relation.From,
        //                         to: relation.To
        //                     });
        //                 } else {
        //                     console.warn("Skipping line with nonexistent node:", relation);
        //                 }
        //             });
        
        //             console.log("Nodes:", nodes);
        //             console.log("Lines:", lines);
        
        //             oModel.setProperty("/nodes", nodes);
        //             oModel.setProperty("/lines", lines);
        //         } else {
        //             console.error("Unexpected response format", oEmployeeData, oRelasiData);
        //         }
        //     }.bind(this)).fail(function (oError) {
        //         console.error("Error fetching data", oError);
        //         console.error("Error details:", oError.responseText);
        //     });
        // },

        _openDetail: function(oNode, oButton) {
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
                    controller: this // Ensure the controller is passed to the fragment
                }).then(function(oDialog) {
                    this._oDialog = oDialog;
                    this.getView().addDependent(this._oDialog); // Add the dialog as a dependent to the view
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
            // var eDock = sap.ui.core.Popup.Dock;
            oMenu.openBy(oButton);
        },

        _setFilter: function () {
            var aNodesCond = [],
                aLinesCond = [];
            var fnAddBossCondition = function (sBoss) {
                aNodesCond.push(new sap.ui.model.Filter({
                    path: 'id',
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sBoss
                }));

                aNodesCond.push(new sap.ui.model.Filter({
                    path: 'supervisor',
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sBoss
                }));
            };

            var fnAddLineCondition = function (sLine) {
                aLinesCond.push(new sap.ui.model.Filter({
                    path: "from",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sLine
                }));
            };

            this._mExplored.forEach(function (oItem) {
                fnAddBossCondition(oItem);
                fnAddLineCondition(oItem);
            });

            this._graph.getBinding("nodes").filter(new sap.ui.model.Filter({
                filters: aNodesCond,
                and: false
            }));

            this._graph.getBinding("lines").filter(new sap.ui.model.Filter({
                filters: aLinesCond,
                and: false
            }));
        },

        _loadMore: function (sSupervisor) {
            if (!sSupervisor) {
                console.error("No supervisor provided for loading data.");
                return;
            }
        
            console.log("Loading data for supervisor:", sSupervisor);
        
            // Update the top supervisor and explored nodes
            this._sTopSupervisor = sSupervisor;
            if (!this._mExplored.includes(sSupervisor)) {
                this._mExplored.push(sSupervisor);
            }
        
            // Clear the graph and fetch new data
            this._graph.deselect();
            this._graph.destroyAllElements();
            this._fetchData();
        },

        // _loadMore: function(sName) {
        //     console.log("Loading data for supervisor:", sName);
        //     this._graph.deselect();
        //     this._mExplored.push(sName);
        //     this._sTopSupervisor = sName;
        //     this._graph.destroyAllElements();
        //     this._setFilter();
        //     this._fetchData();
        // },

        _getCustomDataValue: function(oNode, sName) {
            var aItems = oNode.getCustomData().filter(function (oData) {
                return oData.getKey() === sName;
            });

            var value = aItems.length > 0 ? aItems[0].getValue() : null;
            console.log("Custom data value for", sName, "is:", value); // Debugging
            return value;

            // return aItems.length > 0 ? aItems[0].getValue() : null;
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

            console.log("Navigating to mutation page with Employee Number:", sEmployeeNumber);

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

            console.log("Navigating to mutation page with Employee Number:", sEmployeeNumber);

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

            console.log("Navigating to mutation page with Employee Number:", sEmployeeNumber);

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

            console.log("Navigating to mutation page with Employee Number:", sEmployeeNumber);

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

            console.log("Navigating to mutation page with Employee Number:", sEmployeeNumber);

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

        linePress: function(oEvent) {
            oEvent.bPreventDefault = true;
        },

        onExit: function() {
            if (this._pQuickView) {
                this._pQuickView.then(function(oQuickView) {
                    oQuickView.destroy();
                });
            }
            this._currentEmployee = null;
        }
    });
});