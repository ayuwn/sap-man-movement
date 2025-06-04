sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ushell/services/UserInfo"
], function (BaseController, formatter, JSONModel, MessageBox, Filter, FilterOperator, Fragment, UserInfo) {
    "use strict";

    return BaseController.extend("bsim.hcmapp.man.movement.controller.Approval", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            
            this._oBusy = new sap.m.BusyDialog();
            this._currentUser();
            this._oHistoryModel = new JSONModel();
            this.getView().setModel(this._oHistoryModel, "approvalModel");
            this.getRouter().getRoute("approval").attachPatternMatched(this._onApprovalRouteMatched, this);
        },

        onSelectionChange: function(oEvent) {
            var oTable = oEvent.getSource();
            var aSelectedItems = oTable.getSelectedItems();
            var oModel = this.getView().getModel("approvalModel");
            var aInvalidStatus = ["A", "P", "V", "R"];
            aSelectedItems.forEach(function(oItem) {
                var oCtx = oItem.getBindingContext("approvalModel");
                if (oCtx) {
                    var sStatus = oCtx.getProperty("Status");
                    if (aInvalidStatus.includes(sStatus)) {
                        oTable.setSelectedItem(oItem, false); // <-- This is the correct way
                        sap.m.MessageToast.show("Mohon untuk memilih pengajuan yang belum diproses.");
                    }
                }
            });
        },

        // onRowSelectionChange: function(oEvent) {
        //     var oTable = this.byId("approvalTable");
        //     var aIndices = oTable.getSelectedIndices();
        //     var oModel = this.getView().getModel("approvalModel");
        //     var aRows = oModel.getProperty("/items") || [];
        //     var aInvalidStatus = ["A", "P", "V", "R"];
        //     aIndices.forEach(function(iIdx) {
        //         var oRow = aRows[iIdx];
        //         if (oRow && aInvalidStatus.includes(oRow.Status)) {
        //             oTable.removeSelectionInterval(iIdx, iIdx);
        //             sap.m.MessageToast.show("You cannot select requests with status A, P, V, or R.");
        //         }
        //     });
        // },

        reqListSearchField: function(oEvent) {
            let sValue = oEvent.getParameter("value");
            let oFilter = new Filter({
                filters: [
                    new Filter("EmployeeNumber", FilterOperator.EQ, sValue),
                    new Filter("EmployeeName/FormattedName", FilterOperator.Contains, sValue)
                ],
                and: false
            }),
             oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },

        onEmployeeApprovalPressed: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("approvalModel");
            var sRequestId = oContext.getProperty("RequestId");

            if (!sRequestId) {
                console.error("No Request ID found in node data");
                return;
            }

            console.log("Navigating to detail approval with request id:", sRequestId);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

            // Define the OData models
            const aODataModels = [
                { model: this.getOwnerComponent().getModel(), name: "Default" },
                { model: this.getOwnerComponent().getModel("Promotion"), name: "Promotion" },
                { model: this.getOwnerComponent().getModel("StatusChange"), name: "StatusChange" },
                { model: this.getOwnerComponent().getModel("Assignment"), name: "Assignment" },
                { model: this.getOwnerComponent().getModel("Demotion"), name: "Demotion" },
                { model: this.getOwnerComponent().getModel("Acting"), name: "Acting" },
            ];

            // Function to fetch data from a model
            const fetchData = (oModel, modelName) => {
                return new Promise((resolve, reject) => {
                    if (!oModel) {
                        console.warn(`OData model ${modelName} not available.`);
                        resolve(null);
                        return;
                    }

                    const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
                    oModel.read(sRequestPath, {
                        success: function (oRequestData) {
                            console.log(`RequestSet data retrieved successfully from ${modelName}:`, oRequestData);
                            resolve({ data: oRequestData, modelName });
                        },
                        error: function (oError) {
                            console.error(`Error retrieving RequestSet data from ${modelName}:`, oError);
                            resolve(null); // Resolve with null to continue processing other models
                        }
                    });
                });
            };

            // Fetch data from all models
            const aPromises = aODataModels.map(({ model, name }) => fetchData(model, name));

            Promise.all(aPromises)
                .then((aResults) => {
                    // Find the first valid result
                    const oResult = aResults.find(result => result !== null);

                    if (!oResult) {
                        console.error("No valid data found for the given RequestId.");
                        sap.m.MessageBox.error("Failed to retrieve data for the selected request.");
                        return;
                    }

                    const { data: oRequestData, modelName } = oResult;

                    // Check if the model is "StatusChange"
                    if (modelName === "StatusChange") {
                        console.log("Model is StatusChange. Navigating to detailapprovalstatuschange.");
                        oRouter.navTo("detailapprovalstatuschange", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Demotion") {
                        console.log("Model is Demotion. Navigating to detailapprovaldem.");
                        oRouter.navTo("detailapprovaldem", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Promotion") {
                        console.log("Model is Promotion. Navigating to detailapprovalprom.");
                        oRouter.navTo("detailapprovalprom", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Acting") {
                        console.log("Model is Acting. Navigating to detailapprovalacting.");
                        oRouter.navTo("detailapprovalacting", {
                            RequestId: sRequestId
                        });
                    } else if (modelName === "Assignment") {
                        console.log("Model is Assignment. Navigating to detailapprovalassign.");
                        oRouter.navTo("detailapprovalassign", {
                            RequestId: sRequestId
                        });
                    } else {
                        console.log(`Model is ${modelName}. Navigating to detailapprovalmovement.`);
                        oRouter.navTo("detailapprovalmov", {
                            RequestId: sRequestId
                        });
                    }
                })
                .catch((oError) => {
                    console.error("Error fetching data from OData models:", oError);
                    sap.m.MessageBox.error("Failed to fetch data from the services.");
                });
        },

        // onEmployeeApprovalPressed: function (oEvent) {
        //     const oItem = oEvent.getSource();
        //     const oContext = oItem.getBindingContext("approvalModel");
        
        //     if (!oContext) {
        //         console.error("No binding context found for the selected item.");
        //         return;
        //     }
        
        //     const oSelectedData = oContext.getObject(); // Get the full object
        //     console.log("Selected Item Data:", oSelectedData); // Debugging statement
        
        //     const sRequestId = oSelectedData.RequestId; // Ensure RequestId exists
        
        //     if (!sRequestId) {
        //         console.error("No RequestId found in the selected item data.");
        //         return;
        //     }
        
        //     console.log("Navigating to detail approval with RequestId:", sRequestId);
        
        //     const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.navTo("detailapproval", {
        //         RequestId: sRequestId
        //     });
        // },

        // onEmployeeApprovalPressed: function (oEvent) {
        //     const oItem = oEvent.getSource();
        //     const oContext = oItem.getBindingContext("approvalModel");
        
        //     if (!oContext) {
        //         console.error("No binding context found for the selected item.");
        //         return;
        //     }
        
        //     const oSelectedData = oContext.getObject(); // Get the full object
        //     console.log("Selected Item Data:", oSelectedData); // Debugging statement
        
        //     const sRequestId = oSelectedData.RequestId; // Ensure RequestId exists
        //     const sEmployeeNumber = oSelectedData.EmployeeNumber; // Ensure EmployeeNumber exists
        
        //     if (!sRequestId || !sEmployeeNumber) {
        //         console.error("No RequestId or EmployeeNumber found in the selected item data.");
        //         return;
        //     }
        
        //     console.log("Navigating to detail approval with RequestId:", sRequestId);
        
        //     const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.navTo("detailapproval", {
        //         RequestId: sRequestId
        //     });
        // },

        // onEmployeeApprovalPressed: function (oEvent) {
        //     var oItem = oEvent.getSource();
        //     var oContext = oItem.getBindingContext("approvalModel");
        //     var sRequestId = oContext.getProperty("RequestId");

        //     if (!sRequestId) {
        //         console.error("No Employee Number found in node data");
        //         return;
        //     }

        //     console.log("Navigating to detail approval with request id:", sRequestId);

        //     var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //     oRouter.navTo("detailapproval", {
        //         RequestId: sRequestId
        //     });
        // },

        _onApprovalRouteMatched: function (t) {
            this._getInitialData();
        },

        _currentUser: function () {
            return new Promise((resolve, reject) => {
                this._oBusy.open();

                const oModels = {
                    Movement: this.getOwnerComponent().getModel(),
                    Promotion: this.getOwnerComponent().getModel("Promotion"),
                    Acting: this.getOwnerComponent().getModel("Acting"),
                    Demotion: this.getOwnerComponent().getModel("Demotion"),
                    Assignment: this.getOwnerComponent().getModel("Assignment"),
                    StatusChange: this.getOwnerComponent().getModel("StatusChange")
                };

                // For each model, read EmployeeDetailSet
                const aPromises = Object.entries(oModels).map(([key, oModel]) => {
                    return new Promise((resolveModel) => {
                        if (!oModel) {
                            console.warn(`[currentUser] OData model '${key}' not available.`);
                            resolveModel({ key, data: null });
                            return;
                        }
                        console.log(`[currentUser] Loading EmployeeDetailSet from model: ${key}`);
                        oModel.read("/EmployeeDetailSet", {
                            success: function (oData) {
                                console.log(`[currentUser] EmployeeDetailSet loaded from '${key}':`, oData);
                                if (oData && oData.results && oData.results.length > 0) {
                                    resolveModel({ key, data: oData.results[0] });
                                } else {
                                    resolveModel({ key, data: null });
                                }
                            },
                            error: function (oError) {
                                console.error(`[currentUser] Error loading EmployeeDetailSet from '${key}':`, oError);
                                resolveModel({ key, data: null });
                            }
                        });
                    });
                });

                Promise.all(aPromises)
                    .then(aResults => {
                        this._oBusy.close();
                        const oUserMap = {};
                        aResults.forEach(r => { oUserMap[r.key] = r.data; });
                        this.getView().setModel(new sap.ui.model.json.JSONModel(oUserMap), "currentUser");
                        resolve(oUserMap);
                    })
                    .catch((err) => {
                        this._oBusy.close();
                        reject(err);
                    });
            });
        },

        // _currentUser: function () {
        //     return new Promise((resolve, reject) => {
        //         // Show busy indicator
        //         this._oBusy.open();
        
        //         var oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
        //         if (!oDataModel) {
        //             console.error("OData model not available");
        //             this._oBusy.close();
        //             MessageBox.error("System error: OData model not available");
        //             reject(new Error("OData model not available"));
        //             return;
        //         }
        
        //         // Call the EmployeeDetailSet endpoint to get logged-in user details
        //         oDataModel.read("/EmployeeDetailSet", {
        //             success: function (oData) {
        //                 console.log("Current user data received:", oData);
        
        //                 if (!oData || !oData.results || oData.results.length === 0) {
        //                     this._oBusy.close();
        //                     MessageBox.error("No user data received from server");
        //                     reject(new Error("No user data received from server"));
        //                     return;
        //                 }
        
        //                 // Get the first user from the results
        //                 var oCurrentUser = oData.results[0];
        
        //                 // Store the employee ID for later use
        //                 this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
        //                 // Create a model for current user details
        //                 var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
        //                 this.getView().setModel(oCurrentUserModel, "currentUser");
        
        //                 this._oBusy.close();
        //                 resolve(oCurrentUser); // Resolve the Promise with the current user data
        //             }.bind(this),
        //             error: function (oError) {
        //                 this._oBusy.close();
        //                 console.error("Error fetching current user data:", oError);
        //                 MessageBox.error(
        //                     "Failed to load user details: " +
        //                     (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
        //                 );
        //                 reject(oError); // Reject the Promise with the error
        //             }.bind(this)
        //         });
        //     });
        // },

        // onMassApprove: function () {
        //     var oTable = this.byId("approvalTable");
        //     var aSelectedContexts = oTable.getSelectedContexts();
        //     if (!aSelectedContexts.length) {
        //         sap.m.MessageBox.warning("Please select at least one request to approve.");
        //         return;
        //     }

        //     var aSelectedRequests = aSelectedContexts
        //         .map(function (oCtx) { return oCtx.getObject(); })
        //         .filter(function (oReq) {
        //             return ["A", "R", "P", "V"].indexOf(oReq.Status) === -1;
        //         });

        //     if (!aSelectedRequests.length) {
        //         sap.m.MessageBox.warning("No valid requests selected for approval.");
        //         return;
        //     }

        //     this._oBusy.open();

        //     var that = this;
        //     var aApprovePromises = aSelectedRequests.map(function (oReq) {
        //         var oModel = that.getOwnerComponent().getModel(oReq.SourceModel || undefined);
        //         var sPath = "/RequestSet(guid'" + oReq.RequestId + "')";
        //         const oDateTime = that._createApprovalDateTime();
        //         var oPayload = {
        //             RequestId: oReq.RequestId,
        //             SequenceNumber: oReq.SequenceNumber,
        //             Stat: oReq.Stat,
        //             ObjectType: oReq.ObjectType,
        //             ApproverId: oReq.ApproverId,
        //             Abbreviation: oReq.Abbreviation,
        //             Status: "A",
        //             StatusText: "Approved",
        //             ApprovalUser: oReq.ApproverId,
        //             Notes: "",
        //             ApprovalDate: oDateTime.ApprovalDate,
        //             ApprovalTime: oDateTime.ApprovalTime
        //         };

        //         // --- Force single operation per request ---
        //         var bWasBatch = oModel.bUseBatch;
        //         oModel.setUseBatch(false);

        //         return new Promise(function (resolve, reject) {
        //             oModel.update(sPath, oPayload, {
        //                 method: "MERGE",
        //                 success: function () {
        //                     oModel.setUseBatch(bWasBatch);
        //                     resolve({ RequestId: oReq.RequestId, status: "success" });
        //                 },
        //                 error: function (err) {
        //                     oModel.setUseBatch(bWasBatch);
        //                     reject({ RequestId: oReq.RequestId, status: "failed", error: err });
        //                 }
        //             });
        //         });
        //     });

        //     Promise.allSettled(aApprovePromises)
        //         .then(function (results) {
        //             var nSuccess = results.filter(r => r.status === "fulfilled").length;
        //             var nFail = results.length - nSuccess;
        //             // Optionally, log or process each result with RequestId
        //             results.forEach(function(r) {
        //                 if (r.status === "fulfilled") {
        //                     console.log("Approved:", r.value.RequestId);
        //                 } else {
        //                     console.warn("Failed:", r.reason.RequestId, r.reason.error);
        //                 }
        //             });
        //             sap.m.MessageBox.success(nSuccess + " approved, " + nFail + " failed.");
        //             that._getInitialData();
        //         })
        //         .catch(function () {
        //             sap.m.MessageBox.error("Mass approval failed.");
        //         })
        //         .finally(function () {
        //             that._oBusy.close();
        //         });
        // },

        onMassApprove: function () {
            var oTable = this.byId("approvalTable");
            var aSelectedContexts = oTable.getSelectedContexts();
            if (!aSelectedContexts.length) {
                sap.m.MessageBox.warning("Please select at least one request to approve.");
                return;
            }

            var aSelectedRequests = aSelectedContexts
                .map(function (oCtx) { return oCtx.getObject(); })
                .filter(function (oReq) {
                    return ["A", "R", "P", "V"].indexOf(oReq.Status) === -1;
                });

            if (!aSelectedRequests.length) {
                sap.m.MessageBox.warning("No valid requests selected for approval.");
                return;
            }

            this._oBusy.open();
            var that = this;

            // Load current user from all models
            this._currentUser().then(function (oCurrentUser) {
                // Check IsMass in all models
                var bCanMassApprove = Object.values(oCurrentUser).some(function (userData) {
                    return userData && userData.IsMass === true;
                });

                if (!bCanMassApprove) {
                    that._oBusy.close();
                    sap.m.MessageBox.error("Anda tidak diperbolehkan untuk melakukan mass approval.");
                    return;
                }

                var aApprovePromises = aSelectedRequests.map(function (oReq) {
                    // Use SourceModel to get the correct model
                    var oModel = oReq.SourceModel
                        ? that.getOwnerComponent().getModel(oReq.SourceModel)
                        : that.getOwnerComponent().getModel();

                    if (!oModel) {
                        return Promise.reject({ RequestId: oReq.RequestId, status: "failed", error: "Model not found for RequestId" });
                    }

                    // Get the correct EmployeeNumber for this SourceModel
                    var sEmpId = oCurrentUser[oReq.SourceModel || "Movement"] && oCurrentUser[oReq.SourceModel || "Movement"].EmployeeNumber;

                    // Find the correct approval step for the current user
                    var sToApprovalPath = `/RequestSet(guid'${oReq.RequestId}')/toApproval`;
                    return new Promise(function (resolve, reject) {
                        oModel.read(sToApprovalPath, {
                            success: function (oData) {
                                // Find the approval entry for the logged-in user and not yet approved
                                var oApproval = (oData.results || []).find(function (entry) {
                                    return entry.ApproverId === sEmpId && (!entry.Status || entry.Status === "");
                                });
                                if (!oApproval) {
                                    reject({ RequestId: oReq.RequestId, status: "failed", error: "Approval entry not found for current user" });
                                    return;
                                }
                                var sPath = "/RequestSet(guid'" + oReq.RequestId + "')";
                                const oDateTime = that._createApprovalDateTime();
                                var oPayload = {
                                    RequestId: oReq.RequestId,
                                    SequenceNumber: oApproval.SequenceNumber,
                                    Stat: oApproval.Stat,
                                    ObjectType: oApproval.ObjectType,
                                    ApproverId: oApproval.ApproverId,
                                    Abbreviation: oApproval.Abbreviation,
                                    Status: "A",
                                    StatusText: "Approved",
                                    ApprovalUser: oApproval.ApproverId,
                                    Notes: "",
                                    ApprovalDate: oDateTime.ApprovalDate,
                                    ApprovalTime: oDateTime.ApprovalTime
                                };
                                var bWasBatch = oModel.bUseBatch;
                                oModel.setUseBatch(false);
                                oModel.update(sPath, oPayload, {
                                    method: "MERGE",
                                    success: function () {
                                        oModel.setUseBatch(bWasBatch);
                                        resolve({ RequestId: oReq.RequestId, SequenceNumber: oApproval.SequenceNumber, status: "success" });
                                    },
                                    error: function (err) {
                                        oModel.setUseBatch(bWasBatch);
                                        reject({ RequestId: oReq.RequestId, SequenceNumber: oApproval.SequenceNumber, status: "failed", error: err });
                                    }
                                });
                            },
                            error: function (err) {
                                reject({ RequestId: oReq.RequestId, status: "failed", error: err });
                            }
                        });
                    });
                });

                Promise.allSettled(aApprovePromises)
                    .then(function (results) {
                        var nSuccess = results.filter(r => r.status === "fulfilled").length;
                        var nFail = results.length - nSuccess;
                        results.forEach(function(r) {
                            if (r.status === "fulfilled") {
                                console.log("Approved:", r.value.RequestId, r.value.SequenceNumber);
                            } else {
                                console.warn("Failed:", r.reason.RequestId, r.reason.error);
                            }
                        });
                        sap.m.MessageBox.success(nSuccess + " approved, " + nFail + " failed.");
                        that._getInitialData();
                    })
                    .catch(function () {
                        sap.m.MessageBox.error("Mass approval failed.");
                    })
                    .finally(function () {
                        that._oBusy.close();
                    });
            });
        },

        // fix mass approve
        // onMassApprove: function () {
        //     var oTable = this.byId("approvalTable");
        //     var aSelectedContexts = oTable.getSelectedContexts();
        //     if (!aSelectedContexts.length) {
        //         sap.m.MessageBox.warning("Please select at least one request to approve.");
        //         return;
        //     }

        //     var aSelectedRequests = aSelectedContexts
        //         .map(function (oCtx) { return oCtx.getObject(); })
        //         .filter(function (oReq) {
        //             return ["A", "R", "P", "V"].indexOf(oReq.Status) === -1;
        //         });

        //     if (!aSelectedRequests.length) {
        //         sap.m.MessageBox.warning("No valid requests selected for approval.");
        //         return;
        //     }

        //     this._oBusy.open();

        //     var that = this;
        //     // Load all OData models
        //     var aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("StatusChange")
        //     ];

        //     // For each request, find the model where it exists, then approve
        //     var aApprovePromises = aSelectedRequests.map(function (oReq) {
        //         // Try to find the model that contains this RequestId
        //         var aModelChecks = aODataModels.map(function (oModel) {
        //             return new Promise(function (resolve) {
        //                 if (!oModel) {
        //                     resolve(null);
        //                     return;
        //                 }
        //                 var sPath = "/RequestSet(guid'" + oReq.RequestId + "')";
        //                 oModel.read(sPath, {
        //                     success: function () { resolve(oModel); },
        //                     error: function () { resolve(null); }
        //                 });
        //             });
        //         });

        //         // Once we find the model, send the approval update
        //         return Promise.all(aModelChecks).then(function (aModels) {
        //             var oModel = aModels.find(Boolean);
        //             if (!oModel) {
        //                 return Promise.reject({ RequestId: oReq.RequestId, status: "failed", error: "Model not found for RequestId" });
        //             }
        //             var sPath = "/RequestSet(guid'" + oReq.RequestId + "')";
        //             const oDateTime = that._createApprovalDateTime();
        //             var oPayload = {
        //                 RequestId: oReq.RequestId,
        //                 SequenceNumber: oReq.SequenceNumber,
        //                 Stat: oReq.Stat,
        //                 ObjectType: oReq.ObjectType,
        //                 ApproverId: oReq.ApproverId,
        //                 Abbreviation: oReq.Abbreviation,
        //                 Status: "A",
        //                 StatusText: "Approved",
        //                 ApprovalUser: oReq.ApproverId,
        //                 Notes: "",
        //                 ApprovalDate: oDateTime.ApprovalDate,
        //                 ApprovalTime: oDateTime.ApprovalTime
        //             };
        //             var bWasBatch = oModel.bUseBatch;
        //             oModel.setUseBatch(false);
        //             return new Promise(function (resolve, reject) {
        //                 oModel.update(sPath, oPayload, {
        //                     method: "MERGE",
        //                     success: function () {
        //                         oModel.setUseBatch(bWasBatch);
        //                         resolve({ RequestId: oReq.RequestId, status: "success" });
        //                     },
        //                     error: function (err) {
        //                         oModel.setUseBatch(bWasBatch);
        //                         reject({ RequestId: oReq.RequestId, status: "failed", error: err });
        //                     }
        //                 });
        //             });
        //         });
        //     });

        //     Promise.allSettled(aApprovePromises)
        //         .then(function (results) {
        //             var nSuccess = results.filter(r => r.status === "fulfilled").length;
        //             var nFail = results.length - nSuccess;
        //             results.forEach(function(r) {
        //                 if (r.status === "fulfilled") {
        //                     console.log("Approved:", r.value.RequestId);
        //                 } else {
        //                     console.warn("Failed:", r.reason.RequestId, r.reason.error);
        //                 }
        //             });
        //             sap.m.MessageBox.success(nSuccess + " approved, " + nFail + " failed.");
        //             that._getInitialData();
        //         })
        //         .catch(function () {
        //             sap.m.MessageBox.error("Mass approval failed.");
        //         })
        //         .finally(function () {
        //             that._oBusy.close();
        //         });
        // },ss

        // onMassApprove: function () {
        //     var oTable = this.byId("approvalTable");
        //     var aSelectedContexts = oTable.getSelectedContexts();
        //     if (!aSelectedContexts.length) {
        //         sap.m.MessageBox.warning("Please select at least one request to approve.");
        //         return;
        //     }

        //     var aSelectedRequests = aSelectedContexts
        //         .map(function (oCtx) { return oCtx.getObject(); })
        //         .filter(function (oReq) {
        //             return ["A", "R", "P", "V"].indexOf(oReq.Status) === -1;
        //         });

        //     if (!aSelectedRequests.length) {
        //         sap.m.MessageBox.warning("No valid requests selected for approval.");
        //         return;
        //     }

        //     this._oBusy.open();

        //     var aApprovePromises = aSelectedRequests.map(function (oReq) {
        //         var oModel = this.getOwnerComponent().getModel(oReq.SourceModel || undefined);
        //         var sPath = "/RequestSet(guid'" + oReq.RequestId + "')";
        //         const oDateTime = this._createApprovalDateTime();
        //         var oPayload = {
        //             SequenceNumber: oReq.SequenceNumber,
        //             Stat: oReq.Stat,
        //             ObjectType: oReq.ObjectType,
        //             ApproverId: oReq.ApproverId,
        //             Abbreviation: oReq.Abbreviation,
        //             Status: "A",
        //             StatusText: "Approved",
        //             ApprovalUser: oReq.ApproverId,
        //             Notes: "",
        //             ApprovalDate: oDateTime.ApprovalDate,
        //             ApprovalTime: oDateTime.ApprovalTime
        //         };
        //         return new Promise(function (resolve, reject) {
        //             oModel.update(sPath, oPayload, {
        //                 method: "MERGE",
        //                 success: resolve,
        //                 error: reject
        //             });
        //         });
        //     }.bind(this));

        //     Promise.allSettled(aApprovePromises)
        //         .then(function (results) {
        //             var nSuccess = results.filter(r => r.status === "fulfilled").length;
        //             var nFail = results.length - nSuccess;
        //             sap.m.MessageBox.success(nSuccess + " approved, " + nFail + " failed.");
        //             this._getInitialData();
        //         }.bind(this))
        //         .catch(function () {
        //             sap.m.MessageBox.error("Mass approval failed.");
        //         })
        //         .finally(function () {
        //             this._oBusy.close();
        //         }.bind(this));
        // },

        _createApprovalDateTime: function () {
            var oDate = new Date();
            var sApprovalDate = oDate.toISOString().split(".")[0];
            var sApprovalTime = `PT${oDate.getHours()}H${oDate.getMinutes()}M${oDate.getSeconds()}S`;
            return {
                ApprovalDate: sApprovalDate,
                ApprovalTime: sApprovalTime
            };
        },

        // onMassApprove: function () {
        //     var oTable = this.byId("approvalTable");
        //     var aSelectedContexts = oTable.getSelectedContexts();
        //     if (!aSelectedContexts.length) {
        //         sap.m.MessageBox.warning("Please select at least one request to approve.");
        //         return;
        //     }

        //     // Only approve items with allowed statuses
        //     var aSelectedRequests = aSelectedContexts
        //         .map(function (oCtx) { return oCtx.getObject(); })
        //         .filter(function (oReq) {
        //             return ["A", "R", "P", "V"].indexOf(oReq.Status) === -1;
        //         });

        //     if (!aSelectedRequests.length) {
        //         sap.m.MessageBox.warning("No valid requests selected for approval.");
        //         return;
        //     }

        //     this._oBusy.open();

        //     var aApprovePromises = aSelectedRequests.map(function (oReq) {
        //         var oModel = this.getOwnerComponent().getModel(oReq.SourceModel || undefined);
        //         var sPath = "/RequestSet(guid'" + oReq.RequestId + "')";
        //         return new Promise(function (resolve, reject) {
        //             oModel.update(sPath, { Status: "A" }, {
        //                 method: "MERGE",
        //                 success: resolve,
        //                 error: reject
        //             });
        //         });
        //     }.bind(this));

        //     Promise.allSettled(aApprovePromises)
        //         .then(function (results) {
        //             var nSuccess = results.filter(r => r.status === "fulfilled").length;
        //             var nFail = results.length - nSuccess;
        //             sap.m.MessageBox.success(nSuccess + " approved, " + nFail + " failed.");
        //             this._getInitialData();
        //         }.bind(this))
        //         .catch(function () {
        //             sap.m.MessageBox.error("Mass approval failed.");
        //         })
        //         .finally(function () {
        //             this._oBusy.close();
        //         }.bind(this));
        // },

        // _getInitialData: function () {
        //     // Define the OData models for all services
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(), 
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Define filters for the logged-in user's requests
        //             const aFilters = [
        //                 new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             // Fetch data from all OData services
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]); 
        //                         return;
        //                     }
        
        //                     oModel.read("/RequestSet", {
        //                         filters: aFilters,
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded from service:", oRequestData);
        
        //                             const aDetailPromises = oRequestData.results.map(request => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                                             oModel.read(sRequestPath, {
        //                                                 success: function (oApprovalData) {
        //                                                     console.log("Approval Data:", oApprovalData);
        //                                                     const aApprovals = oApprovalData.results || [];
        //                                                     const oPendingApproval = aApprovals.find(approval => 
        //                                                         approval.ApproverId === sLoggedInEmployeeId && (!approval.Status || approval.Status !== "A")
        //                                                     );
        
        //                                                     if (oPendingApproval) {
        //                                                         resolveDetail({
        //                                                             RequestId: request.RequestId,
        //                                                             EmployeeNumber: request.EmployeeNumber,
        //                                                             EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                             DivisionText: oEmployeeData.DivisionText,
        //                                                             ActionType: oEmployeeData.ActionType,
        //                                                             ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                             Massg: request.Massg,
        //                                                             PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                             MassgDesc: request.MassgDesc,
        //                                                             ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                             ZenddaEfktf: request.ZenddaEfktf,
        //                                                             CreatedOn: request.CreatedOn,
        //                                                             StatusText: oPendingApproval.StatusText, 
        //                                                             ApproverName: oPendingApproval.ApproverName,
        //                                                             Stat: oPendingApproval.Stat
        //                                                         });
        //                                                     } else {
        //                                                         resolveDetail(null); // Skip if no pending approval found
        //                                                     }
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.error(`Error loading toApproval for RequestId ${request.RequestId}:`, oError);
        //                                                     rejectDetail(oError);
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                                             rejectDetail(oError);
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.all(aDetailPromises)
        //                                 .then(aDetails => resolve(aDetails.filter(detail => detail !== null))) // Filter out null entries
        //                                 .catch(reject);
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet from service:", oError);
        //                             resolve([]); 
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Filtered RequestSet Data:", aCombinedResults);
        
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load request data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         { name: "Default", model: this.getOwnerComponent().getModel() },
        //         { name: "Promotion", model: this.getOwnerComponent().getModel("Promotion") },
        //         { name: "Acting", model: this.getOwnerComponent().getModel("Acting") },
        //         { name: "Demotion", model: this.getOwnerComponent().getModel("Demotion") },
        //         { name: "Assignment", model: this.getOwnerComponent().getModel("Assignment") },
        //         { name: "StatusChange", model: this.getOwnerComponent().getModel("StatusChange") },
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             const aFilters = [
        //                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             const aPromises = aODataModels.map(oModelEntry => {
        //                 const oModel = oModelEntry.model;
        //                 const sModelName = oModelEntry.name;
        
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn(`OData model '${sModelName}' not available.`);
        //                         resolve([]); // Resolve with an empty array if the model is not available
        //                         return;
        //                     }
        
        //                     oModel.read("/ApprovalListSet", {
        //                         filters: aFilters,
        //                         success: function (oApprovalData) {
        //                             console.log(`ApprovalListSet loaded from service '${sModelName}':`, oApprovalData);
        
        //                             if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                                 console.warn(`No approval requests found in '${sModelName}'.`);
        //                                 resolve([]);
        //                                 return;
        //                             }
        
        //                             // Fetch additional details for each approval
        //                             const aDetailPromises = oApprovalData.results.map(approval => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                                     oModel.read(sRequestPath, {
        //                                         success: function (oRequestData) {
        //                                             const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                             oModel.read(sEmployeePath, {
        //                                                 success: function (oEmployeeData) {
        //                                                     resolveDetail({
        //                                                         RequestId: approval.RequestId,
        //                                                         EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                         Position: oEmployeeData.EmployeePosition || "N/A",
        //                                                         ActionType: oEmployeeData.ActionType || "N/A",
        //                                                         ReasonForAction: oRequestData.MassgDesc || "N/A",
        //                                                         DateAction: oRequestData.ZbegdaEfktf || "N/A",
        //                                                         DateRequest: oRequestData.CreatedOn || "N/A",
        //                                                         Status: approval.Status || "N/A",
        //                                                         StatusText: approval.StatusText || "N/A",
        //                                                         ApproverName: approval.ApproverName || "N/A",
        //                                                         SourceModel: sModelName // Add source model name for debugging or display
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.warn(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
        //                                                     resolveDetail(null); // Skip this entry if EmployeeDetailSet fails
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.warn(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
        //                                             resolveDetail(null); // Skip this entry if RequestSet fails
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.allSettled(aDetailPromises)
        //                                 .then(aResults => {
        //                                     const aValidDetails = aResults
        //                                         .filter(result => result.status === "fulfilled" && result.value !== null)
        //                                         .map(result => result.value);
        //                                     resolve(aValidDetails);
        //                                 })
        //                                 .catch(oError => {
        //                                     console.error("Error processing details for approvals:", oError);
        //                                     resolve([]); // Resolve with an empty array to avoid breaking the flow
        //                                 });
        //                         },
        //                         error: function (oError) {
        //                             console.error(`Error loading ApprovalListSet from service '${sModelName}':`, oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined Approval Data:", aCombinedResults);
        
        //                     // Set the combined data into the model
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         { name: "", model: this.getOwnerComponent().getModel() },
        //         { name: "Promotion", model: this.getOwnerComponent().getModel("Promotion") },
        //         { name: "Acting", model: this.getOwnerComponent().getModel("Acting") },
        //         { name: "Demotion", model: this.getOwnerComponent().getModel("Demotion") },
        //         { name: "Assignment", model: this.getOwnerComponent().getModel("Assignment") },
        //         { name: "StatusChange", model: this.getOwnerComponent().getModel("StatusChange") },
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             const aFilters = [
        //                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             const aPromises = aODataModels.map(oModelEntry => {
        //                 const oModel = oModelEntry.model;
        //                 const sModelName = oModelEntry.name;
        
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn(`OData model '${sModelName}' not available.`);
        //                         resolve([]); // Resolve with an empty array if the model is not available
        //                         return;
        //                     }
        
        //                     oModel.read("/ApprovalListSet", {
        //                         filters: aFilters,
        //                         success: function (oApprovalData) {
        //                             console.log(`ApprovalListSet loaded from service '${sModelName}':`, oApprovalData);
        
        //                             if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                                 console.warn(`No approval requests found in '${sModelName}'.`);
        //                                 resolve([]);
        //                                 return;
        //                             }
        
        //                             // Filter out approved/rejected items
        //                             const aFilteredData = oApprovalData.results.filter(item => item.Status !== "A" && item.Status !== "R");
        
        //                             // Add additional binding content if needed
        //                             const aEnhancedData = aFilteredData.map(item => ({
        //                                 ...item,
        //                                 SourceModel: sModelName // Add source model name for debugging or display
        //                             }));
        
        //                             resolve(aEnhancedData);
        //                         },
        //                         error: function (oError) {
        //                             console.error(`Error loading ApprovalListSet from service '${sModelName}':`, oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined Approval Data:", aCombinedResults);
        
        //                     // Set the combined data into the model
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         { name: "Default", model: this.getOwnerComponent().getModel() },
        //         { name: "Promotion", model: this.getOwnerComponent().getModel("Promotion") },
        //         { name: "Acting", model: this.getOwnerComponent().getModel("Acting") },
        //         { name: "Demotion", model: this.getOwnerComponent().getModel("Demotion") },
        //         { name: "Assignment", model: this.getOwnerComponent().getModel("Assignment") },
        //         { name: "StatusChange", model: this.getOwnerComponent().getModel("StatusChange") },
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             const aFilters = [
        //                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             const aPromises = aODataModels.map(oModelEntry => {
        //                 const oModel = oModelEntry.model;
        //                 const sModelName = oModelEntry.name;
        
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn(`OData model '${sModelName}' not available.`);
        //                         resolve([]); // Resolve with an empty array if the model is not available
        //                         return;
        //                     }
        
        //                     oModel.read("/ApprovalListSet", {
        //                         filters: aFilters,
        //                         success: function (oApprovalData) {
        //                             console.log(`ApprovalListSet loaded from service '${sModelName}':`, oApprovalData);
        
        //                             if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                                 console.warn(`No approval requests found in '${sModelName}'.`);
        //                                 resolve([]);
        //                                 return;
        //                             }
        
        //                             // Filter out approved/rejected items
        //                             const aFilteredData = oApprovalData.results.filter(item => item.Status !== "A" && item.Status !== "R");
        
        //                             // Fetch additional details for each approval
        //                             const aDetailPromises = aFilteredData.map(approval => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                                     oModel.read(sRequestPath, {
        //                                         success: function (oRequestData) {
        //                                             const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                             oModel.read(sEmployeePath, {
        //                                                 success: function (oEmployeeData) {
        //                                                     resolveDetail({
        //                                                         RequestId: approval.RequestId,
        //                                                         EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                         Position: oEmployeeData.EmployeePosition || "N/A",
        //                                                         ActionType: oEmployeeData.ActionType || "N/A",
        //                                                         ReasonForAction: oRequestData.MassgDesc || "N/A",
        //                                                         DateAction: oRequestData.ZbegdaEfktf || "N/A",
        //                                                         DateRequest: oRequestData.CreatedOn || "N/A",
        //                                                         Status: approval.Status || "N/A",
        //                                                         StatusText: approval.StatusText || "N/A",
        //                                                         ApproverName: approval.ApproverName || "N/A",
        //                                                         SourceModel: sModelName // Add source model name for debugging or display
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.warn(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
        //                                                     resolveDetail(null); // Skip this entry if EmployeeDetailSet fails
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.warn(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
        //                                             resolveDetail(null); // Skip this entry if RequestSet fails
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.allSettled(aDetailPromises)
        //                                 .then(aResults => {
        //                                     const aValidDetails = aResults
        //                                         .filter(result => result.status === "fulfilled" && result.value !== null)
        //                                         .map(result => result.value);
        //                                     resolve(aValidDetails);
        //                                 })
        //                                 .catch(oError => {
        //                                     console.error("Error processing details for approvals:", oError);
        //                                     resolve([]); // Resolve with an empty array to avoid breaking the flow
        //                                 });
        //                         },
        //                         error: function (oError) {
        //                             console.error(`Error loading ApprovalListSet from service '${sModelName}':`, oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined Approval Data:", aCombinedResults);
        
        //                     // Set the combined data into the model
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //     ];

        //     this._oBusy.open();

        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;

        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve) => {
        //                     if (!oModel) {
        //                         resolve([]);
        //                         return;
        //                     }

        //                     oModel.read("/RequestSet", {
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             if (!oRequestData.results || oRequestData.results.length === 0) {
        //                                 resolve([]);
        //                                 return;
        //                             }

        //                             // For each request, find all approvals for the current user
        //                             const aDetailPromises = oRequestData.results.map(request => {
        //                                 return new Promise((resolveDetail) => {
        //                                     // Find ALL approval entries for the current user
        //                                     const aUserApprovals = (request.toApproval && request.toApproval.results)
        //                                         ? request.toApproval.results.filter(a => a.ApproverId === sLoggedInEmployeeId)
        //                                         : [];

        //                                     if (!aUserApprovals.length) {
        //                                         resolveDetail([]);
        //                                         return;
        //                                     }

        //                                     // Fetch EmployeeDetailSet for display info
        //                                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                         success: function (oEmployeeData) {
        //                                             // Map each approval entry for the user
        //                                             const aApprovals = aUserApprovals.map(approval => ({
        //                                                 RequestId: request.RequestId,
        //                                                 EmployeeNumber: request.EmployeeNumber,
        //                                                 EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                                 DivisionText: oEmployeeData.DivisionText,
        //                                                 ActionType: oEmployeeData.ActionType,
        //                                                 ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                 PlansDesc_Dest: request.PlansDesc_Dest,
        //                                                 Massg: request.Massg,
        //                                                 MassgDesc: request.MassgDesc,
        //                                                 ZbegdaEfktf: request.ZbegdaEfktf,
        //                                                 CreatedOn: request.CreatedOn,
        //                                                 StatusText: approval.StatusText,
        //                                                 ApproverName: approval.ApproverName,
        //                                                 ApproverId: approval.ApproverId,
        //                                                 Status: approval.Status
        //                                             }));
        //                                             resolveDetail(aApprovals);
        //                                         },
        //                                         error: function () {
        //                                             resolveDetail([]);
        //                                         }
        //                                     });
        //                                 });
        //                             });

        //                             Promise.all(aDetailPromises)
        //                                 .then(aDetails => resolve(aDetails.flat()))
        //                                 .catch(() => resolve([]));
        //                         },
        //                         error: function () {
        //                             resolve([]);
        //                         }
        //                     });
        //                 });
        //             });

        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        //                     this._oBusy.close();
        //                 })
        //                 .catch(() => {
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(() => {
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //     ];

        //     this._oBusy.open();

        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             const aFilters = [
        //                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];

        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve) => {
        //                     if (!oModel) {
        //                         resolve([]);
        //                         return;
        //                     }

        //                     oModel.read("/ApprovalListSet", {
        //                         filters: aFilters,
        //                         success: function (oApprovalData) {
        //                             console.log("ApprovalListSet loaded:", oApprovalData);
        //                             if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                                 resolve([]);
        //                                 return;
        //                             }

        //                             const aDetailPromises = oApprovalData.results.map(approval => {
        //                                 // return new Promise((resolveDetail) => {
        //                                 //     const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                                 //     oModel.read(sRequestPath, {
        //                                 //         success: function (oRequestData) {
        //                                 //             const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                 //             oModel.read(sEmployeePath, {
        //                                 //                 success: function (oEmployeeData) {
        //                                 //                     resolveDetail({
        //                                 //                         RequestId: approval.RequestId,
        //                                 //                         EmployeeNumber: oRequestData.EmployeeNumber,
        //                                 //                         EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                 //                         DivisionText: oEmployeeData.DivisionText,
        //                                 //                         ActionType: oEmployeeData.ActionType,
        //                                 //                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                 //                         // Show PositionName if ActionType is ZB, else PlansDesc_Dest
        //                                 //                         PlansDesc_Dest: oEmployeeData.ActionType === "ZB"
        //                                 //                             ? (oEmployeeData.PositionName || oRequestData.PositionName || "")
        //                                 //                             : (oRequestData.PlansDesc_Dest || ""),
        //                                 //                         Massg: oRequestData.Massg,
        //                                 //                         MassgDesc: oRequestData.MassgDesc,
        //                                 //                         ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                 //                         CreatedOn: oRequestData.CreatedOn,
        //                                 //                         StatusText: approval.StatusText,
        //                                 //                         ApproverName: approval.ApproverName,
        //                                 //                         ApproverId: approval.ApproverId,
        //                                 //                         Status: approval.Status
        //                                 //                     });
        //                                 //                 },
        //                                 //                 error: function () {
        //                                 //                     resolveDetail(null);
        //                                 //                 }
        //                                 //             });
        //                                 //         },
        //                                 //         error: function () {
        //                                 //             resolveDetail(null);
        //                                 //         }
        //                                 //     });
        //                                 // });
        //                                 return new Promise((resolveDetail) => {
        //                                 const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                                 oModel.read(sRequestPath, {
        //                                     success: function (oRequestData) {
        //                                         const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                         oModel.read(sEmployeePath, {
        //                                             success: function (oEmployeeData) {
        //                                                 // Fetch ApproverName from /toApproval
        //                                                 const sToApprovalPath = `/RequestSet(guid'${approval.RequestId}')/toApproval`;
        //                                                 oModel.read(sToApprovalPath, {
        //                                                     success: function (oToApprovalData) {
        //                                                         // Find the entry for the current ApproverId
        //                                                         let sApproverName = approval.ApproverName;
        //                                                         if (oToApprovalData.results && oToApprovalData.results.length > 0) {
        //                                                             const oMatch = oToApprovalData.results.find(a => a.ApproverId === approval.ApproverId);
        //                                                             if (oMatch && oMatch.ApproverName) {
        //                                                                 sApproverName = oMatch.ApproverName;
        //                                                             }
        //                                                         }
        //                                                         resolveDetail({
        //                                                             RequestId: approval.RequestId,
        //                                                             EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                             EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                             DivisionText: oEmployeeData.DivisionText,
        //                                                             ActionType: oEmployeeData.ActionType,
        //                                                             ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                             PlansDesc_Dest: oEmployeeData.ActionType === "ZB"
        //                                                                 ? (oEmployeeData.PositionName || oRequestData.PositionName || "")
        //                                                                 : (oRequestData.PlansDesc_Dest || ""),
        //                                                             Massg: oRequestData.Massg,
        //                                                             MassgDesc: oRequestData.MassgDesc,
        //                                                             ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                                             CreatedOn: oRequestData.CreatedOn,
        //                                                             StatusText: approval.StatusText,
        //                                                             ApproverName: sApproverName,
        //                                                             ApproverId: approval.ApproverId,
        //                                                             Status: approval.Status,
        //                                                             Stat: approval.Stat
        //                                                         });
        //                                                     },
        //                                                     error: function () {
        //                                                         // fallback to approval.ApproverName if /toApproval fails
        //                                                         resolveDetail({
        //                                                             RequestId: approval.RequestId,
        //                                                             EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                             EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                             DivisionText: oEmployeeData.DivisionText,
        //                                                             ActionType: oEmployeeData.ActionType,
        //                                                             ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                             PlansDesc_Dest: oEmployeeData.ActionType === "ZB"
        //                                                                 ? (oEmployeeData.PositionName || oRequestData.PositionName || "")
        //                                                                 : (oRequestData.PlansDesc_Dest || ""),
        //                                                             Massg: oRequestData.Massg,
        //                                                             MassgDesc: oRequestData.MassgDesc,
        //                                                             ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                                             CreatedOn: oRequestData.CreatedOn,
        //                                                             StatusText: approval.StatusText,
        //                                                             ApproverName: approval.ApproverName,
        //                                                             ApproverId: approval.ApproverId,
        //                                                             Status: approval.Status,
        //                                                             Stat: approval.Stat
        //                                                         });
        //                                                     }
        //                                                 });
        //                                             },
        //                                             error: function () {
        //                                                 resolveDetail(null);
        //                                             }
        //                                         });
        //                                     },
        //                                     error: function () {
        //                                         resolveDetail(null);
        //                                     }
        //                                 });
        //                             });
        //                             });

        //                             Promise.all(aDetailPromises)
        //                                 .then(aDetails => resolve(aDetails.filter(detail => detail !== null)))
        //                                 .catch(() => resolve([]));
        //                         },
        //                         error: function () {
        //                             resolve([]);
        //                         }
        //                     });
        //                 });
        //             });

        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     // Sort by CreatedOn descending (newest first)
        //                     aCombinedResults.sort(function(a, b) {
        //                         return new Date(b.CreatedOn) - new Date(a.CreatedOn);
        //                     });

        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        //                     this._oBusy.close();
        //                 })
        //                 .catch(() => {
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(() => {
        //             this._oBusy.close();
        //         });
        // },

        _getInitialData: function () {
            // Define OData models with their names for SourceModel tracking
            const aODataModels = [
                { name: "", model: this.getOwnerComponent().getModel() },
                { name: "Promotion", model: this.getOwnerComponent().getModel("Promotion") },
                { name: "Acting", model: this.getOwnerComponent().getModel("Acting") },
                { name: "Demotion", model: this.getOwnerComponent().getModel("Demotion") },
                { name: "Assignment", model: this.getOwnerComponent().getModel("Assignment") },
                { name: "StatusChange", model: this.getOwnerComponent().getModel("StatusChange") }
            ];

            this._oBusy.open();

            this._currentUser()
                .then(oCurrentUser => {
                    const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
                    const aFilters = [
                        new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
                    ];

                    const aPromises = aODataModels.map(oModelEntry => {
                        const oModel = oModelEntry.model;
                        const sModelName = oModelEntry.name;
                        return new Promise((resolve) => {
                            if (!oModel) {
                                resolve([]);
                                return;
                            }

                            oModel.read("/ApprovalListSet", {
                                filters: aFilters,
                                success: function (oApprovalData) {
                                    if (!oApprovalData.results || oApprovalData.results.length === 0) {
                                        resolve([]);
                                        return;
                                    }

                                    const aDetailPromises = oApprovalData.results.map(approval => {
                                        return new Promise((resolveDetail) => {
                                            const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
                                            oModel.read(sRequestPath, {
                                                success: function (oRequestData) {
                                                    const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
                                                    oModel.read(sEmployeePath, {
                                                        success: function (oEmployeeData) {
                                                            // Fetch ApproverName from /toApproval
                                                            const sToApprovalPath = `/RequestSet(guid'${approval.RequestId}')/toApproval`;
                                                            oModel.read(sToApprovalPath, {
                                                                success: function (oToApprovalData) {
                                                                    // Find the entry for the current ApproverId
                                                                    let sApproverName = approval.ApproverName;
                                                                    let sSequenceNumber = approval.SequenceNumber;
                                                                    let sStat = approval.Stat;
                                                                    let sAbbreviation = approval.Abbreviation;
                                                                    let sObjectType = approval.ObjectType;
                                                                    if (oToApprovalData.results && oToApprovalData.results.length > 0) {
                                                                        const oMatch = oToApprovalData.results.find(a => a.ApproverId === approval.ApproverId);
                                                                        if (oMatch) {
                                                                            if (oMatch.ApproverName) sApproverName = oMatch.ApproverName;
                                                                            if (oMatch.SequenceNumber) sSequenceNumber = oMatch.SequenceNumber;
                                                                            if (oMatch.Stat) sStat = oMatch.Stat;
                                                                            if (oMatch.Abbreviation) sAbbreviation = oMatch.Abbreviation;
                                                                            if (oMatch.ObjectType) sObjectType = oMatch.ObjectType;
                                                                        }
                                                                    }
                                                                    resolveDetail({
                                                                        RequestId: approval.RequestId,
                                                                        SequenceNumber: sSequenceNumber,
                                                                        EmployeeNumber: oRequestData.EmployeeNumber,
                                                                        EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
                                                                        DivisionText: oEmployeeData.DivisionText,
                                                                        ActionType: oEmployeeData.ActionType,
                                                                        ActionTypeDesc: oEmployeeData.ActionTypeDesc,
                                                                        PlansDesc_Dest: oEmployeeData.ActionType === "ZB"
                                                                            ? (oEmployeeData.PositionName || oRequestData.PositionName || "")
                                                                            : (oRequestData.PlansDesc_Dest || ""),
                                                                        Massg: oRequestData.Massg,
                                                                        MassgDesc: oRequestData.MassgDesc,
                                                                        ZbegdaEfktf: oRequestData.ZbegdaEfktf,
                                                                        CreatedOn: oRequestData.CreatedOn,
                                                                        StatusText: approval.StatusText,
                                                                        ApproverName: sApproverName,
                                                                        ApproverId: approval.ApproverId,
                                                                        Status: approval.Status,
                                                                        Stat: sStat,
                                                                        Abbreviation: sAbbreviation,
                                                                        ObjectType: sObjectType,
                                                                        SourceModel: sModelName // <-- Track the source model
                                                                    });
                                                                },
                                                                error: function () {
                                                                    // fallback to approval.ApproverName if /toApproval fails
                                                                    resolveDetail({
                                                                        RequestId: approval.RequestId,
                                                                        SequenceNumber: approval.SequenceNumber,
                                                                        EmployeeNumber: oRequestData.EmployeeNumber,
                                                                        EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
                                                                        DivisionText: oEmployeeData.DivisionText,
                                                                        ActionType: oEmployeeData.ActionType,
                                                                        ActionTypeDesc: oEmployeeData.ActionTypeDesc,
                                                                        PlansDesc_Dest: oEmployeeData.ActionType === "ZB"
                                                                            ? (oEmployeeData.PositionName || oRequestData.PositionName || "")
                                                                            : (oRequestData.PlansDesc_Dest || ""),
                                                                        Massg: oRequestData.Massg,
                                                                        MassgDesc: oRequestData.MassgDesc,
                                                                        ZbegdaEfktf: oRequestData.ZbegdaEfktf,
                                                                        CreatedOn: oRequestData.CreatedOn,
                                                                        StatusText: approval.StatusText,
                                                                        ApproverName: approval.ApproverName,
                                                                        ApproverId: approval.ApproverId,
                                                                        Status: approval.Status,
                                                                        Stat: approval.Stat,
                                                                        Abbreviation: approval.Abbreviation,
                                                                        ObjectType: approval.ObjectType,
                                                                        SourceModel: sModelName
                                                                    });
                                                                }
                                                            });
                                                        },
                                                        error: function () {
                                                            resolveDetail(null);
                                                        }
                                                    });
                                                },
                                                error: function () {
                                                    resolveDetail(null);
                                                }
                                            });
                                        });
                                    });

                                    Promise.all(aDetailPromises)
                                        .then(aDetails => resolve(aDetails.filter(detail => detail !== null)))
                                        .catch(() => resolve([]));
                                },
                                error: function () {
                                    resolve([]);
                                }
                            });
                        });
                    });

                    Promise.all(aPromises)
                        .then(aResults => {
                            const aCombinedResults = aResults.flat();
                            // Sort by CreatedOn descending (newest first)
                            aCombinedResults.sort(function(a, b) {
                                return new Date(b.CreatedOn) - new Date(a.CreatedOn);
                            });

                            const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
                            this.getView().setModel(oApprovalModel, "approvalModel");
                            this._oBusy.close();
                        })
                        .catch(() => {
                            this._oBusy.close();
                        });
                })
                .catch(() => {
                    this._oBusy.close();
                });
        },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             const aFilters = [
        //                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]); 
        //                         return;
        //                     }
        
        //                     oModel.read("/ApprovalListSet", {
        //                         filters: aFilters,
        //                         success: function (oApprovalData) {
        //                             console.log("ApprovalListSet loaded from service:", oApprovalData);
        
        //                             if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                                 console.warn("No approval requests found in ApprovalListSet.");
        //                                 resolve([]);
        //                                 return;
        //                             }
        
        //                             const aFilteredData = oApprovalData.results;
        
        //                             const aDetailPromises = aFilteredData.map(approval => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                                     oModel.read(sRequestPath, {
        //                                         success: function (oRequestData) {
        //                                             console.log(`RequestSet data loaded for RequestId ${approval.RequestId}:`, oRequestData);
        
        //                                             const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                             oModel.read(sEmployeePath, {
        //                                                 success: function (oEmployeeData) {
        //                                                     console.log(`EmployeeDetailSet data loaded for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oEmployeeData);
        
        //                                                     resolveDetail({
        //                                                         RequestId: approval.RequestId,
        //                                                         EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         PlansDesc_Dest: oRequestData.PlansDesc_Dest,
        //                                                         Massg: oRequestData.Massg,
        //                                                         MassgDesc: oRequestData.MassgDesc,
        //                                                         ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                                         CreatedOn: oRequestData.CreatedOn,
        //                                                         StatusText: oRequestData.StatusText,
        //                                                         ApproverName: approval.ApproverName,
        //                                                         ApproverId: approval.ApproverId,
        //                                                         Status: approval.Status
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.warn(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
        //                                                     resolveDetail(null);
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.warn(`RequestId ${approval.RequestId} not found or already deleted. Skipping.`, oError);
        //                                             resolveDetail(null);
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.allSettled(aDetailPromises)
        //                                 .then(aResults => {
        //                                     const aValidDetails = aResults
        //                                         .filter(result => result.status === "fulfilled" && result.value !== null)
        //                                         .map(result => result.value);
        //                                     console.log("Valid details loaded successfully:", aValidDetails);
        //                                     resolve(aValidDetails);
        //                                 })
        //                                 .catch(oError => {
        //                                     console.error("Unexpected error while processing details:", oError);
        //                                     resolve([]); // Resolve with an empty array to avoid breaking the flow
        //                                 });
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading ApprovalListSet from service:", oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined Approval Data:", aCombinedResults);
        
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //     ];
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             const aFilters = [
        //                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //             ];
        
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]); // Resolve with an empty array if the model is not available
        //                         return;
        //                     }
        
        //                     oModel.read("/ApprovalListSet", {
        //                         filters: aFilters,
        //                         success: function (oApprovalData) {
        //                             console.log("ApprovalListSet loaded from service:", oApprovalData);
        
        //                             if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                                 console.warn("No approval requests found in ApprovalListSet.");
        //                                 resolve([]);
        //                                 return;
        //                             }
        
        //                             const aFilteredData = oApprovalData.results.filter(item => item.Status !== "A" && item.Status !== "R");
        
        //                             const aDetailPromises = aFilteredData.map(approval => {
        //                                 return new Promise((resolveDetail, rejectDetail) => {
        //                                     const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                                     oModel.read(sRequestPath, {
        //                                         success: function (oRequestData) {
        //                                             console.log(`RequestSet data loaded for RequestId ${approval.RequestId}:`, oRequestData);
        
        //                                             const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                             oModel.read(sEmployeePath, {
        //                                                 success: function (oEmployeeData) {
        //                                                     console.log(`EmployeeDetailSet data loaded for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oEmployeeData);
        
        //                                                     resolveDetail({
        //                                                         RequestId: approval.RequestId,
        //                                                         EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                         EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                         DivisionText: oEmployeeData.DivisionText,
        //                                                         ActionType: oEmployeeData.ActionType,
        //                                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                         PlansDesc_Dest: oRequestData.PlansDesc_Dest,
        //                                                         Massg: oRequestData.Massg,
        //                                                         MassgDesc: oRequestData.MassgDesc,
        //                                                         ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                                         CreatedOn: oRequestData.CreatedOn,
        //                                                         StatusText: oRequestData.StatusText,
        //                                                         ApproverName: approval.ApproverName,
        //                                                         ApproverId: approval.ApproverId,
        //                                                         Status: approval.Status
        //                                                     });
        //                                                 },
        //                                                 error: function (oError) {
        //                                                     console.warn(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
        //                                                     resolveDetail(null);
        //                                                 }
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.warn(`RequestId ${approval.RequestId} not found or already deleted. Skipping.`, oError);
        //                                             // Log detailed error information
        //                                             console.error("Error details:", {
        //                                                 message: oError.message,
        //                                                 statusCode: oError.statusCode,
        //                                                 responseText: oError.responseText
        //                                             });
        //                                             resolveDetail(null);
        //                                         }
        //                                     });
        //                                 });
        //                             });
        
        //                             Promise.all(aDetailPromises)
        //                                 .then(aDetails => {
        //                                     // Filter out null entries (skipped requests)
        //                                     const aValidDetails = aDetails.filter(detail => detail !== null);
        //                                     console.log("Valid details loaded successfully:", aValidDetails);
        //                                     resolve(aValidDetails);
        //                                 })
        //                                 .catch(oError => {
        //                                     console.error("Error loading details for approvals:", oError);
        //                                     reject(new Error("Failed to load details for approvals."));
        //                                 });
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading ApprovalListSet from service:", oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat();
        //                     console.log("Combined Approval Data:", aCombinedResults);
        
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found in ApprovalListSet.");
        //                         sap.m.MessageBox.information("No approval requests found.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Filter out items with determined status (Approved/Rejected)
        //                     const aFilteredData = oApprovalData.results.filter(item => {
        //                         return item.Status !== "A" && item.Status !== "R";
        //                     });
        
        //                     console.log("Filtered Approval Data:", aFilteredData);
        
        //                     // Fetch data from /RequestSet and /EmployeeDetailSet for each RequestId
        //                     const aPromises = aFilteredData.map(approval => {
        //                         return new Promise((resolve, reject) => {
        //                             const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                             oDataModel.read(sRequestPath, {
        //                                 success: function (oRequestData) {
        //                                     console.log("RequestSet data loaded for RequestId:", approval.RequestId, oRequestData);
        
        //                                     // Fetch EmployeeDetailSet for the EmployeeNumber
        //                                     const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                     oDataModel.read(sEmployeePath, {
        //                                         success: function (oEmployeeData) {
        //                                             console.log("EmployeeDetailSet data loaded for EmployeeNumber:", oRequestData.EmployeeNumber, oEmployeeData);
        
        //                                             resolve({
        //                                                 RequestId: approval.RequestId,
        //                                                 EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                 EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                 DivisionText: oEmployeeData.DivisionText,
        //                                                 ActionType: oEmployeeData.ActionType,
        //                                                 ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                 PlansDesc_Dest: oRequestData.PlansDesc_Dest,
        //                                                 Massg: oRequestData.Massg,
        //                                                 MassgDesc: oRequestData.MassgDesc,
        //                                                 ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                                 CreatedOn: oRequestData.CreatedOn,
        //                                                 StatusText: oRequestData.StatusText,
        //                                                 ApproverName: approval.ApproverName,
        //                                                 ApproverId: approval.ApproverId,
        //                                                 Status: approval.Status
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
        //                                             reject(oError);
        //                                         }
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         });
        //                     });
        
        //                     // Wait for all promises to resolve
        //                     Promise.all(aPromises)
        //                         .then(aCombinedData => {
        //                             console.log("Combined data:", aCombinedData);
        
        //                             // Set the combined data to the approvalModel
        //                             const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                             this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                             this._oBusy.close();
        //                         })
        //                         .catch(oError => {
        //                             console.error("Error combining data:", oError);
        //                             sap.m.MessageBox.error("Failed to load combined data.");
        //                             this._oBusy.close();
        //                         });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data.");
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found in ApprovalListSet.");
        //                         sap.m.MessageBox.information("No approval requests found.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Filter out items with determined status (Approved/Rejected) by the logged-in user
        //                     const aFilteredData = oApprovalData.results.filter(item => {
        //                         return (
        //                             item.Status !== "Approved" &&
        //                             item.Status !== "Rejected"
        //                         );
        //                     });
        
        //                     console.log("Filtered Approval Data:", aFilteredData);
        
        //                     // Fetch data from /RequestSet and /EmployeeDetailSet for each RequestId
        //                     const aPromises = aFilteredData.map(approval => {
        //                         return new Promise((resolve, reject) => {
        //                             const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                             oDataModel.read(sRequestPath, {
        //                                 success: function (oRequestData) {
        //                                     console.log("RequestSet data loaded for RequestId:", approval.RequestId, oRequestData);
        
        //                                     // Fetch EmployeeDetailSet for the EmployeeNumber
        //                                     const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                     oDataModel.read(sEmployeePath, {
        //                                         success: function (oEmployeeData) {
        //                                             console.log("EmployeeDetailSet data loaded for EmployeeNumber:", oRequestData.EmployeeNumber, oEmployeeData);
        
        //                                             resolve({
        //                                                 RequestId: approval.RequestId,
        //                                                 EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                 EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                 DivisionText: oEmployeeData.DivisionText,
        //                                                 ActionType: oEmployeeData.ActionType,
        //                                                 ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                 PlansDesc_Dest: oRequestData.PlansDesc_Dest,
        //                                                 MassgDesc: oRequestData.MassgDesc,
        //                                                 ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                                 CreatedOn: oRequestData.CreatedOn,
        //                                                 StatusText: oRequestData.StatusText,
        //                                                 ApproverName: approval.ApproverName,
        //                                                 Status: approval.Status
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
        //                                             reject(oError);
        //                                         }
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         });
        //                     });
        
        //                     // Wait for all promises to resolve
        //                     Promise.all(aPromises)
        //                         .then(aCombinedData => {
        //                             console.log("Combined data:", aCombinedData);
        
        //                             // Set the combined data to the approvalModel
        //                             const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                             this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                             this._oBusy.close();
        //                         })
        //                         .catch(oError => {
        //                             console.error("Error combining data:", oError);
        //                             sap.m.MessageBox.error("Failed to load combined data.");
        //                             this._oBusy.close();
        //                         });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data.");
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found in ApprovalListSet.");
        //                         sap.m.MessageBox.information("No approval requests found.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Fetch data from /RequestSet and /EmployeeDetailSet for each RequestId
        //                     const aPromises = oApprovalData.results.map(approval => {
        //                         return new Promise((resolve, reject) => {
        //                             const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                             oDataModel.read(sRequestPath, {
        //                                 success: function (oRequestData) {
        //                                     console.log("RequestSet data loaded for RequestId:", approval.RequestId, oRequestData);
        
        //                                     // Fetch EmployeeDetailSet for the EmployeeNumber
        //                                     const sEmployeePath = `/EmployeeDetailSet('${oRequestData.EmployeeNumber}')`;
        //                                     oDataModel.read(sEmployeePath, {
        //                                         success: function (oEmployeeData) {
        //                                             console.log("EmployeeDetailSet data loaded for EmployeeNumber:", oRequestData.EmployeeNumber, oEmployeeData);
        
        //                                             resolve({
        //                                                 RequestId: approval.RequestId,
        //                                                 EmployeeNumber: oRequestData.EmployeeNumber,
        //                                                 EmployeeName: oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                                 DivisionText: oEmployeeData.DivisionText,
        //                                                 ActionType: oEmployeeData.ActionType,
        //                                                 ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                                 PlansDesc_Dest: oRequestData.PlansDesc_Dest,
        //                                                 MassgDesc: oRequestData.MassgDesc,
        //                                                 ZbegdaEfktf: oRequestData.ZbegdaEfktf,
        //                                                 CreatedOn: oRequestData.CreatedOn,
        //                                                 StatusText: oRequestData.StatusText,
        //                                                 ApproverName: approval.ApproverName,
        //                                                 Status: approval.Status
        //                                             });
        //                                         },
        //                                         error: function (oError) {
        //                                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${oRequestData.EmployeeNumber}:`, oError);
        //                                             reject(oError);
        //                                         }
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         });
        //                     });
        
        //                     // Wait for all promises to resolve
        //                     Promise.all(aPromises)
        //                         .then(aCombinedData => {
        //                             console.log("Combined data:", aCombinedData);
        
        //                             // Set the combined data to the approvalModel
        //                             const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                             this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                             this._oBusy.close();
        //                         })
        //                         .catch(oError => {
        //                             console.error("Error combining data:", oError);
        //                             sap.m.MessageBox.error("Failed to load combined data.");
        //                             this._oBusy.close();
        //                         });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data.");
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        updateApprovalStatus: function (sRequestId, sStatus) {
            const oDataModel = this.getOwnerComponent().getModel();
        
            if (!oDataModel) {
                console.error("OData model not available");
                return;
            }
        
            this._oBusy.open();
        
            // Prepare the payload for the update
            const oPayload = {
                Status: sStatus,
                StatusText: sStatus === "A" ? "Approved" : "Rejected"
            };
        
            // Path to the specific RequestSet entity
            const sPath = `/RequestSet(guid'${sRequestId}')`;
        
            // Use the update method to modify the existing entity
            oDataModel.update(sPath, oPayload, {
                method: "MERGE", // Use MERGE for partial updates
                success: function () {
                    MessageBox.success("Approval status updated successfully");
        
                    // Refresh the list data
                    this._getInitialData();
                }.bind(this),
                error: function (oError) {
                    console.error("Error updating approval status:", oError);
                    MessageBox.error("Failed to update approval status");
                }.bind(this)
            });
        },

        onApproveStatus: function (oEvent) {
            const oButton = oEvent.getSource();
            const sRequestId = oButton.getBindingContext("approvalModel").getProperty("RequestId");
        
            if (!sRequestId) {
                MessageBox.error("No RequestId found for the selected item.");
                return;
            }
        
            this.updateApprovalStatus(sRequestId, "A"); // "A" for Approved
        },
        
        onRejectStatus: function (oEvent) {
            const oButton = oEvent.getSource();
            const sRequestId = oButton.getBindingContext("approvalModel").getProperty("RequestId");
        
            if (!sRequestId) {
                MessageBox.error("No RequestId found for the selected item.");
                return;
            }
        
            this.updateApprovalStatus(sRequestId, "R"); // "R" for Rejected
        },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found in ApprovalListSet.");
        //                         sap.m.MessageBox.information("No approval requests found.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Fetch data from /RequestSet for each RequestId
        //                     const aPromises = oApprovalData.results.map(approval => {
        //                         return new Promise((resolve, reject) => {
        //                             const sRequestPath = `/RequestSet(guid'${approval.RequestId}')`;
        //                             oDataModel.read(sRequestPath, {
        //                                 success: function (oRequestData) {
        //                                     console.log("RequestSet data loaded for RequestId:", approval.RequestId, oRequestData);
        
        //                                     resolve({
        //                                         RequestId: approval.RequestId,
        //                                         EmployeeName: oRequestData.EmployeeName,
        //                                         ActionType: oRequestData.ActionType,
        //                                         ReasonForAction: oRequestData.MassgDesc, // Assuming MassgDesc is the reason for action
        //                                         DateAction: oRequestData.ZbegdaEfktf, // Assuming ZbegdaEfktf is the date of action
        //                                         DateRequest: oRequestData.CreatedOn, // Assuming CreatedOn is the date of request
        //                                         ApproverName: approval.ApproverName,
        //                                         Status: approval.Status,
        //                                         StatusText: approval.StatusText
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading RequestSet for RequestId ${approval.RequestId}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         });
        //                     });
        
        //                     // Wait for all promises to resolve
        //                     Promise.all(aPromises)
        //                         .then(aCombinedData => {
        //                             console.log("Combined data:", aCombinedData);
        
        //                             // Set the combined data to the approvalModel
        //                             const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                             this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                             this._oBusy.close();
        //                         })
        //                         .catch(oError => {
        //                             console.error("Error combining data:", oError);
        //                             sap.m.MessageBox.error("Failed to load combined data.");
        //                             this._oBusy.close();
        //                         });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval data.");
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found in ApprovalListSet.");
        //                         sap.m.MessageBox.information("No approval requests found.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Map the approval data to a format suitable for the view
        //                     const aMappedData = oApprovalData.results.map(approval => ({
        //                         RequestId: approval.RequestId,
        //                         SequenceNumber: approval.SequenceNumber,
        //                         ApproverId: approval.ApproverId,
        //                         ApproverName: approval.ApproverName,
        //                         Abbreviation: approval.Abbreviation,
        //                         Status: approval.Status,
        //                         StatusText: approval.StatusText,
        //                         ApprovalDate: approval.ApprovalDate,
        //                         ApprovalUser: approval.ApprovalUser,
        //                         ApprovalTime: approval.ApprovalTime,
        //                         Notes: approval.Notes
        //                     }));
        
        //                     console.log("Mapped Approval Data:", aMappedData);
        
        //                     // Set the data to the approvalModel
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aMappedData });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        
        //                     // Parse the error response for meaningful feedback
        //                     let sErrorMessage = "Failed to load approval data.";
        //                     try {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         if (oErrorResponse.error && oErrorResponse.error.message) {
        //                             sErrorMessage = oErrorResponse.error.message.value || sErrorMessage;
        //                         }
        //                     } catch (e) {
        //                         console.error("Error parsing error response:", e);
        //                     }
        
        //                     sap.m.MessageBox.error(sErrorMessage);
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet
        //             const oApprovalListPromise = new Promise((resolve, reject) => {
        //                 oDataModel.read("/ApprovalListSet", {
        //                     urlParameters: {
        //                         "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                     },
        //                     success: function (oApprovalData) {
        //                         console.log("ApprovalListSet loaded:", oApprovalData);
        //                         resolve(oApprovalData.results || []);
        //                     },
        //                     error: function (oError) {
        //                         console.error("Error loading ApprovalListSet:", oError);
        //                         reject(oError);
        //                     }
        //                 });
        //             });
        
        //             // Fetch data from /RequestSet
        //             const oRequestSetPromise = new Promise((resolve, reject) => {
        //                 oDataModel.read("/RequestSet", {
        //                     urlParameters: { "$expand": "toApproval" },
        //                     success: function (oRequestData) {
        //                         console.log("RequestSet loaded:", oRequestData);
        //                         resolve(oRequestData.results || []);
        //                     },
        //                     error: function (oError) {
        //                         console.error("Error loading RequestSet:", oError);
        //                         reject(oError);
        //                     }
        //                 });
        //             });
        
        //             // Combine data from both entities and fetch EmployeeDetailSet
        //             Promise.all([oApprovalListPromise, oRequestSetPromise])
        //                 .then(([aApprovalListData, aRequestSetData]) => {
        //                     console.log("ApprovalListSet Data:", aApprovalListData);
        //                     console.log("RequestSet Data:", aRequestSetData);
        
        //                     // Fetch EmployeeDetailSet for each EmployeeNumber in RequestSet
        //                     const aEmployeePromises = aRequestSetData.map(request => {
        //                         return new Promise((resolve, reject) => {
        //                             oDataModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                                 success: function (oEmployeeData) {
        //                                     resolve({
        //                                         RequestId: request.RequestId,
        //                                         EmployeeNumber: request.EmployeeNumber,
        //                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                         DivisionText: oEmployeeData.DivisionText,
        //                                         ActionType: oEmployeeData.ActionType,
        //                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                         MassgDesc: request.MassgDesc,
        //                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                         CreatedOn: request.CreatedOn,
        //                                         StatusText: request.StatusText
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         });
        //                     });
        
        //                     // Wait for all EmployeeDetailSet promises to resolve
        //                     Promise.all(aEmployeePromises)
        //                         .then(aEmployeeData => {
        //                             console.log("EmployeeDetailSet Data:", aEmployeeData);
        
        //                             // Combine ApprovalListSet and EmployeeDetailSet data
        //                             const aCombinedData = aApprovalListData.map(approval => {
        //                                 const oEmployee = aEmployeeData.find(employee => employee.RequestId === approval.RequestId);
        //                                 return {
        //                                     RequestId: approval.RequestId,
        //                                     SequenceNumber: approval.SequenceNumber,
        //                                     ApproverId: approval.ApproverId,
        //                                     ApproverName: approval.ApproverName,
        //                                     Abbreviation: approval.Abbreviation,
        //                                     Status: approval.Status,
        //                                     StatusText: approval.StatusText,
        //                                     ApprovalDate: approval.ApprovalDate,
        //                                     ApprovalUser: approval.ApprovalUser,
        //                                     ApprovalTime: approval.ApprovalTime,
        //                                     Notes: approval.Notes,
        //                                     EmployeeNumber: oEmployee ? oEmployee.EmployeeNumber : "N/A",
        //                                     EmployeeName: oEmployee ? oEmployee.EmployeeName : "Unknown",
        //                                     DivisionText: oEmployee ? oEmployee.DivisionText : "N/A",
        //                                     ActionType: oEmployee ? oEmployee.ActionType : "N/A",
        //                                     ActionTypeDesc: oEmployee ? oEmployee.ActionTypeDesc : "N/A",
        //                                     PlansDesc_Dest: oEmployee ? oEmployee.PlansDesc_Dest : "N/A",
        //                                     MassgDesc: oEmployee ? oEmployee.MassgDesc : "N/A",
        //                                     ZbegdaEfktf: oEmployee ? oEmployee.ZbegdaEfktf : "N/A",
        //                                     CreatedOn: oEmployee ? oEmployee.CreatedOn : "N/A"
        //                                 };
        //                             });
        
        //                             console.log("Combined Data:", aCombinedData);
        
        //                             // Set the combined data to the approvalModel
        //                             const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                             this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                             this._oBusy.close();
        //                         })
        //                         .catch(oError => {
        //                             console.error("Error combining EmployeeDetailSet data:", oError);
        //                             sap.m.MessageBox.error("Failed to load employee details.");
        //                             this._oBusy.close();
        //                         });
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from ApprovalListSet and RequestSet:", oError);
        //                     sap.m.MessageBox.error("Failed to load approval and request data.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Get the logged-in user's employee number
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch data from /ApprovalListSet for the logged-in user
        //             oDataModel.read("/ApprovalListSet", {
        //                 urlParameters: {
        //                     "$filter": `ApproverId eq '${sLoggedInEmployeeId}'`
        //                 },
        //                 success: function (oApprovalData) {
        //                     console.log("ApprovalListSet loaded:", oApprovalData);
        
        //                     if (!oApprovalData.results || oApprovalData.results.length === 0) {
        //                         console.warn("No approval requests found for the logged-in user.");
        //                         sap.m.MessageBox.information("No approval requests found for your user.");
        //                         this._oBusy.close();
        //                         return;
        //                     }
        
        //                     // Map the approval data to a format suitable for the view
        //                     const aMappedData = oApprovalData.results.map(approval => ({
        //                         RequestId: approval.RequestId,
        //                         SequenceNumber: approval.SequenceNumber,
        //                         ApproverId: approval.ApproverId,
        //                         ApproverName: approval.ApproverName,
        //                         Abbreviation: approval.Abbreviation,
        //                         Status: approval.Status,
        //                         StatusText: approval.StatusText,
        //                         ApprovalDate: approval.ApprovalDate,
        //                         ApprovalUser: approval.ApprovalUser,
        //                         ApprovalTime: approval.ApprovalTime,
        //                         Notes: approval.Notes
        //                     }));
        
        //                     console.log("Mapped Approval Data:", aMappedData);
        
        //                     // Set the data to the approvalModel
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aMappedData });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading ApprovalListSet:", oError);
        
        //                     // Parse the error response for meaningful feedback
        //                     let sErrorMessage = "Failed to load approval data.";
        //                     try {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         if (oErrorResponse.error && oErrorResponse.error.message) {
        //                             sErrorMessage = oErrorResponse.error.message.value || sErrorMessage;
        //                         }
        //                     } catch (e) {
        //                         console.error("Error parsing error response:", e);
        //                     }
        
        //                     sap.m.MessageBox.error(sErrorMessage);
        //                     this._oBusy.close();
        //                 }.bind(this)
        //             });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // fix
        // _getInitialData: function () {
        //     const oDataModel = this.getOwnerComponent().getModel();
        
        //     if (!oDataModel) {
        //         console.error("OData model not available");
        //         return;
        //     }
        
        //     this._oBusy.open();
        
        //     // Fetch data from /RequestSet
        //     oDataModel.read("/RequestSet", {
        //         urlParameters: { "$expand": "toApproval" }, // Expand the toApproval navigation property
        //         success: function (oRequestData) {
        //             console.log("RequestSet loaded:", oRequestData);

        //             if (!oRequestData.results || oRequestData.results.length === 0) {
        //                 console.warn("No approval requests found for the logged-in user.");
        //             }
        
        //             // Fetch data from /EmployeeDetailSet for each employee in RequestSet
        //             const aPromises = oRequestData.results.map(request => {
        //                 return new Promise((resolve, reject) => {
        //                     // Fetch EmployeeDetailSet
        //                     oDataModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                         success: function (oEmployeeData) {
        //                             // Fetch ApproverName from toApproval
        //                             const sRequestPath = `/RequestSet(guid'${request.RequestId}')/toApproval`;
        //                             oDataModel.read(sRequestPath, {
        //                                 success: function (oApprovalData) {
        //                                     console.log("Approval Data:", oApprovalData); 
        //                                     resolve({
        //                                         RequestId: request.RequestId,
        //                                         EmployeeNumber: request.EmployeeNumber,
        //                                         EmployeeName: oEmployeeData.EmployeeName || request.EmployeeName,
        //                                         DivisionText: oEmployeeData.DivisionText,
        //                                         ActionType: oEmployeeData.ActionType,
        //                                         ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                         Massg: request.Massg,
        //                                         PlansDesc_Dest: request.PlansDesc_Dest,
        //                                         MassgDesc: request.MassgDesc,
        //                                         ZbegdaEfktf: request.ZbegdaEfktf,
        //                                         CreatedOn: request.CreatedOn,
        //                                         StatusText: request.StatusText,
        //                                         ApproverName: oApprovalData.results && oApprovalData.results.length > 0 ? oApprovalData.results[0].ApproverName : "",
        //                                         ApproverId: oApprovalData.results && oApprovalData.results.length > 0 ? oApprovalData.results[0].ApproverId : "",
        //                                         Abbreviation: oApprovalData.results && oApprovalData.results.length > 0 ? oApprovalData.results[0].Abbreviation : ""
        //                                     });
        //                                 },
        //                                 error: function (oError) {
        //                                     console.error(`Error loading toApproval for RequestId ${request.RequestId}:`, oError);
        //                                     reject(oError);
        //                                 }
        //                             });
        //                         },
        //                         error: function (oError) {
        //                             console.error(`Error loading EmployeeDetailSet for EmployeeNumber ${request.EmployeeNumber}:`, oError);
        //                             reject(oError);
        //                         }
        //                     });
        //                 });
        //             });
        
        //             // Wait for all promises to resolve
        //             Promise.all(aPromises)
        //                 .then(aCombinedData => {
        //                     console.log("Combined data:", aCombinedData);
        
        //                     // Set the combined data to the historyModel
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedData });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data:", oError);
        //                     sap.m.MessageBox.error("Failed to load employee details.");
        //                     this._oBusy.close();
        //                 });
        //         }.bind(this),
        //         error: function (oError) {
        //             console.error("Error loading RequestSet:", oError);
        //             sap.m.MessageBox.error("Failed to load request data.");
        //             this._oBusy.close();
        //         }.bind(this)
        //     });
        // },
               
        // _getInitialData: function () {
        //     var that = this;
        //     var oModel = this.getView().getModel();
        //     this._oBusy.open();
            
        //     // Retrieve data from RequestSet
        //     oModel.read("/RequestSet", {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully:", oRequestData);

        //             // Retrieve data from EmployeeDetailSet for each employee in RequestSet
        //             let aPromises = oRequestData.results.map(request => {
        //                 return new Promise((resolve, reject) => {
        //                     oModel.read(`/EmployeeDetailSet('${request.EmployeeNumber}')`, {
        //                         success: function (oEmployeeData) {
        //                             resolve({
        //                                 ...request,
        //                                 EmployeeName: oEmployeeData.EmployeeName,
        //                                 DivisionText: oEmployeeData.DivisionText,
        //                                 ActionType: oEmployeeData.ActionType,
        //                                 ActionTypeDesc: oEmployeeData.ActionTypeDesc,
        //                                 EmployeePositionLongtext: oEmployeeData.EmployeePositionLongtext
        //                             });
        //                         },
        //                         error: function (oError) {
        //                             reject(oError);
        //                         }
        //                     });
        //                 });
        //             });

        //             // Wait for all promises to resolve
        //             Promise.all(aPromises).then(aCombinedData => {
        //                 that._oHistoryModel.setData({
        //                     items: aCombinedData
        //                 });
        //                 that._oBusy.close();
        //             }).catch(oError => {
        //                 console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                 MessageBox.error("Failed to load employee data");
        //                 that._oBusy.close();
        //             });
        //         },
        //         error: function (oError) {
        //             console.error("Error retrieving RequestSet data:", oError);
        //             MessageBox.error("Failed to load request data");
        //             that._oBusy.close();
        //         }
        //     });
        // },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("overview", {}, true);
            }
        }

    });
});