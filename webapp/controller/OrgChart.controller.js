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
    "sap/m/MenuItem"
], function (BaseController, formatter, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, LayeredLayout, ActionButton, Node, Fragment, MenuItem) {
    "use strict";

    var STARTING_PROFILE = "Jovander";

    return BaseController.extend("bsim.hcmapp.man.movement.controller.OrgChart", {
        formatter: formatter,

        onInit: function () {
            // Initialize the JSON model
            this._oModel = new JSONModel();
            this._oModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);

            this._sTopSupervisor = STARTING_PROFILE;
            this._mExplored = [this._sTopSupervisor];

            this._graph = this.byId("chart"); // Use the ID that matches the view
            this._oModel.setSizeLimit(1000);
            this.getView().setModel(this._oModel);

            // Initialize the employee model
            var oEmployeeModel = new JSONModel();
            this.getView().setModel(oEmployeeModel, "employee");

            this._fetchData();

            this._graph.attachEvent("beforeLayouting", function (oEvent) {
                // nodes are not rendered yet (bOutput === false) so their invalidation triggers parent (graph) invalidation
                // which results in multiple unnecessary loading
                this._graph.preventInvalidation(true);
                this._graph.getNodes().forEach(function (oNode) {
                    var oExpandButton, oDetailButton, oUpOneLevelButton,
                        sTeamSize = this._getCustomDataValue(oNode, "team"),
                        sSupervisor;

                    oNode.removeAllActionButtons();

                    if (!sTeamSize) {
                        // employees without team - hide expand buttons
                        oNode.setShowExpandButton(false);
                    } else {
                        if (this._mExplored.indexOf(oNode.getKey()) === -1) {
                            // managers with team but not yet expanded
                            // we create custom expand button with dynamic loading
                            oNode.setShowExpandButton(true);

                            // this renders icon marking collapse status
                            oNode.setCollapsed(true);
                            // oExpandButton = new ActionButton({
                            //     title: "Expand",
                            //     icon: "sap-icon://sys-add",
                            //     press: function () {
                            //         oNode.setCollapsed(false);
                            //         this._loadMore(oNode.getKey());
                            //     }.bind(this)
                            // });
                            // oNode.addActionButton(oExpandButton);
                        } else {
                            // manager with already loaded data - default expand button
                            oNode.setShowExpandButton(true);
                        }
                    }

                    // add detail link -> custom popover
                    oDetailButton = new ActionButton({
                        title: "Detail",
                        icon: "sap-icon://person-placeholder",
                        press: function (oEvent) {
                            this._openDetail(oNode, oEvent.getParameter("buttonElement"));
                        }.bind(this)
                    });
                    oNode.addActionButton(oDetailButton);

                    // if current user is root we can add 'up one level'
                    if (oNode.getKey() === this._sTopSupervisor) {
                        sSupervisor = this._getCustomDataValue(oNode, "supervisor");
                        if (sSupervisor) {
                            oUpOneLevelButton = new ActionButton({
                                title: "Up one level",
                                icon: "sap-icon://arrow-top",
                                press: function () {
                                    var aSuperVisors = oNode.getCustomData().filter(function (oData) {
                                            return oData.getKey() === "supervisor";
                                        }),
                                        sSupervisor = aSuperVisors.length > 0 && aSuperVisors[0].getValue();

                                    this._loadMore(sSupervisor);
                                    this._sTopSupervisor = sSupervisor;
                                }.bind(this)
                            });
                            oNode.addActionButton(oUpOneLevelButton);
                        }
                    }
                }, this);
                this._graph.preventInvalidation(false);
            }.bind(this));
        },

        _fetchData: function () {
            var sEmployeeUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/EmployeeSet?$format=json";
            var sRelasiUrl = "/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/RelasiSet?$format=json";
            var oModel = this._oModel;
        
            var aEmployeeRequest = $.ajax({
                url: sEmployeeUrl,
                method: "GET"
            });
        
            var aRelasiRequest = $.ajax({
                url: sRelasiUrl,
                method: "GET"
            });
        
            $.when(aEmployeeRequest, aRelasiRequest).done(function (oEmployeeData, oRelasiData) {
                console.log("Employee Data:", oEmployeeData);
                console.log("Relasi Data:", oRelasiData);
        
                if (oEmployeeData[0] && oEmployeeData[0].d && oEmployeeData[0].d.results && oRelasiData[0] && oRelasiData[0].d && oRelasiData[0].d.results) {
                    var employees = oEmployeeData[0].d.results;
                    var relations = oRelasiData[0].d.results;
                    var nodes = [];
                    var lines = [];
                    var nodeKeys = new Set();
        
                    // Transform the employee data into nodes
                    employees.forEach(function (employee) {
                        nodes.push({
                            key: employee.EmployeeNumber,
                            title: employee.EmployeeName,
                            description: employee.Position,
                            phone: employee.Phone,
                            email: employee.Email,
                            location: employee.Location,
                            team: employee.TotalTeam
                        });
                        nodeKeys.add(employee.EmployeeNumber);
                    });
        
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
        
                    oModel.setProperty("/nodes", nodes);
                    oModel.setProperty("/lines", lines);
                } else {
                    console.error("Unexpected response format", oEmployeeData, oRelasiData);
                }
            }.bind(this)).fail(function (oError) {
                console.error("Error fetching data", oError);
                console.error("Error details:", oError.responseText);
            });
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

        _loadMore: function(sName) {
            this._graph.deselect();
            this._mExplored.push(sName);
            this._graph.destroyAllElements();
            this._setFilter();
        },

        _getCustomDataValue: function(oNode, sName) {
            var aItems = oNode.getCustomData().filter(function (oData) {
                return oData.getKey() === sName;
            });

            return aItems.length > 0 ? aItems[0].getValue() : null;
        },

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
                    name: "bsim.hcmapp.man.movement.view.fragments.TooltipFragment",
                    type: "XML",
                    id: this.createId("tooltipFragment"), 
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

        onMutation: function (oEvent) {
            var oItem = oEvent.getSource();
            var sEmployeeNumber = oItem.data("EmployeeNumber") || "00000294";
        
            if (!sEmployeeNumber) {
                console.error("No Employee Number found in custom data");
                return;
            }
        
            console.log("Navigating to employee page with Employee Number:", sEmployeeNumber);
        
            this.getRouter().navTo("mutation", {
                EmployeeNumber: sEmployeeNumber
            });
        },

        onDialogClose: function () {
            if (this._oDialog) {
                this._oDialog.close();
            }
        },

        onNavBack: function () {
            this.getRouter().navTo("overview");
        },

        _navBack: function () {
            this.getView().setBindingContext(null);
            let p = sap.ui.core.routing.History.getInstance().getPreviousHash(),
                i = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation");
            if (p !== undefined) {
                if (i && !i.isInitialNavigation()) {
                    i.historyBack(1);
                } else {
                    window.history.go(-1);
                }
            } else {
                i.toExternal({
                    target: {
                        shellHash: "#",
                    },
                });
            }
        },

        linePress: function(oEvent) {
            oEvent.bPreventDefault = true;
        },

        onHistory: function () {
            this.getRouter().navTo("history");
        },

        onEmployee: function (oEvent) {
            var oItem = oEvent.getSource();
            var sEmployeeNumber = oItem.data("EmployeeNumber") || "00000294";
        
            if (!sEmployeeNumber) {
                console.error("No Employee Number found in custom data");
                return;
            }
        
            console.log("Navigating to employee page with Employee Number:", sEmployeeNumber);
        
            this.getRouter().navTo("employee", {
                EmployeeNumber: sEmployeeNumber
            });
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