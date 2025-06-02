sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], function (Controller, f, J, M, Filter, O, UIComponent, FilterOperator) {
    "use strict";

    return Controller.extend("bsim.hcmapp.man.movement.controller.Overview", {
        formatter: f,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._currentUser();
            this.getRouter().getRoute("overview").attachPatternMatched(this._onOverviewRouteMatched, this);
        },

        _onOverviewRouteMatched: function () {
            this._currentUser()
                .then(() => {
                    this._getInitialData();
                })
                .catch((error) => {
                    console.error("Error initializing current user:", error);
                });
        },

        // _onOverviewRouteMatched: function () {
        //     this._getInitialData();
        // },

        _getInitialData: function () {
            const aODataModels = [
                this.getOwnerComponent().getModel("Promotion"),
                this.getOwnerComponent().getModel(), // Movement (default)
                this.getOwnerComponent().getModel("StatusChange"),
                this.getOwnerComponent().getModel("Assignment"),
                this.getOwnerComponent().getModel("Demotion"),
                this.getOwnerComponent().getModel("Acting"),
            ];
            const sEmployeePath = "/EmployeeSet";
            const sRequestPath = "/RequestSet";

            this._oBusy.open();

            this._currentUser()
                .then(oCurrentUser => {
                    if (!oCurrentUser || !oCurrentUser.EmployeeNumber) {
                        console.error("Invalid current user data:", oCurrentUser);
                        MessageBox.error("Failed to retrieve valid user details.");
                        this._oBusy.close();
                        return;
                    }

                    const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;

                    // Employee count logic (unchanged)
                    const oDefaultModel = this.getOwnerComponent().getModel();
                    if (!oDefaultModel) {
                        console.error("MOVEMENT MODEL NOT FOUND");
                        this._oBusy.close();
                        return;
                    }
                    oDefaultModel.read(sEmployeePath, {
                        urlParameters: { "$format": "json" },
                        success: function (oData) {
                            let oEmployeeModel = this.getView().getModel("employee");
                            if (!oEmployeeModel) {
                                oEmployeeModel = new sap.ui.model.json.JSONModel({ results: [] });
                                this.getView().setModel(oEmployeeModel, "employee");
                            }
                            oEmployeeModel.setProperty("/results", oData.results || oData);
                            const aSubordinates = oData.results.filter(employee => employee.Supervisor === sLoggedInEmployeeId);
                            const oParamModel = this.getView().getModel("appParam");
                            if (oParamModel) {
                                oParamModel.setProperty("/employeeCount", aSubordinates.length);
                            }
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error loading Employee Set:", oError);
                        }.bind(this),
                    });

                    // Approval count (expand for ALL models)
                    // const aApprovalPromises = aODataModels.map(oModel => {
                    //     return new Promise((resolve) => {
                    //         if (!oModel) {
                    //             resolve([]);
                    //             return;
                    //         }
                    //         // Special handling for Movement model (default)
                    //         if (oModel === this.getOwnerComponent().getModel()) {
                    //             oModel.read(sRequestPath, {
                    //                 filters: [
                    //                     new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
                    //                 ],
                    //                 success: function (oRequestData) {
                    //                     const aRequests = oRequestData.results || [];
                    //                     if (aRequests.length === 0) {
                    //                         console.log("[Movement] No requests found for ApproverId:", sLoggedInEmployeeId);
                    //                         resolve([]);
                    //                         return;
                    //                     }
                    //                     // Fetch toApproval for each request
                    //                     const aApprovalFetches = aRequests.map(request => {
                    //                         return new Promise((resolveReq) => {
                    //                             oModel.read(`/RequestSet(guid'${request.RequestId}')/toApproval`, {
                    //                                 success: function (oApprovalData) {
                    //                                     console.log(`[Movement] Loaded toApproval for RequestId ${request.RequestId}:`, oApprovalData);
                    //                                     request.toApproval = oApprovalData.results || [];
                    //                                     resolveReq(request);
                    //                                 },
                    //                                 error: function (err) {
                    //                                     console.warn(`[Movement] Failed to load toApproval for RequestId ${request.RequestId}:`, err);
                    //                                     request.toApproval = [];
                    //                                     resolveReq(request);
                    //                                 }
                    //                             });
                    //                         });
                    //                     });
                    //                     Promise.all(aApprovalFetches).then(aRequestsWithApprovals => {
                    //                         const aFilteredApprovals = aRequestsWithApprovals.filter(request => {
                    //                             const aApprovals = Array.isArray(request.toApproval) ? request.toApproval : [];
                    //                             return aApprovals.some(approval =>
                    //                                 approval.ApproverId === sLoggedInEmployeeId &&
                    //                                 (approval.Status === "" || approval.Status === "S")
                    //                             );
                    //                         });
                    //                         console.log("[Movement] Filtered approvals:", aFilteredApprovals);
                    //                         resolve(aFilteredApprovals);
                    //                     });
                    //                 },
                    //                 error: function (err) {
                    //                     console.error("[Movement] Error loading RequestSet:", err);
                    //                     resolve([]);
                    //                 }
                    //             });
                    //             return;
                    //         }
                    //         // Default logic for other models
                    //         oModel.read(sRequestPath, {
                    //             urlParameters: { "$expand": "toApproval" },
                    //             filters: [
                    //                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
                    //             ],
                    //             success: function (oRequestData) {
                    //                 console.log(`[${oModel.sServiceUrl}] Loaded RequestSet with $expand=toApproval:`, oRequestData);
                    //                 const aFilteredApprovals = (oRequestData.results || []).filter(request => {
                    //                     const aApprovals = (request.toApproval && Array.isArray(request.toApproval.results)) ? request.toApproval.results : [];
                    //                     return aApprovals.some(approval =>
                    //                         approval.ApproverId === sLoggedInEmployeeId &&
                    //                         (approval.Status === "" || approval.Status === "S")
                    //                     );
                    //                 });
                    //                 console.log(`[${oModel.sServiceUrl}] Filtered approvals:`, aFilteredApprovals);
                    //                 resolve(aFilteredApprovals);
                    //             },
                    //             error: function (err) {
                    //                 console.error(`[${oModel.sServiceUrl}] Error loading RequestSet with $expand=toApproval:`, err);
                    //                 resolve([]);
                    //             }
                    //         });
                    //     });
                    // });

                    const aApprovalPromises = aODataModels.map(oModel => {
                        return new Promise((resolve) => {
                            if (!oModel) {
                                resolve([]);
                                return;
                            }
                            oModel.read(sRequestPath, {
                                urlParameters: { "$expand": "toApproval" },
                                success: function (oRequestData) {
                                    let aRequests = [];
                                    if (Array.isArray(oRequestData.results)) {
                                        aRequests = oRequestData.results;
                                    } else if (oRequestData.results) {
                                        aRequests = [oRequestData.results];
                                    } else if (Array.isArray(oRequestData)) {
                                        aRequests = oRequestData;
                                    } else if (oRequestData) {
                                        aRequests = [oRequestData];
                                    }

                                    // Check if toApproval is missing (Movement model fallback)
                                    const isMovement = oModel === this.getOwnerComponent().getModel();
                                    const needsFallback = isMovement && (
                                        !aRequests.length ||
                                        typeof aRequests[0].toApproval === "undefined"
                                    );

                                    if (needsFallback) {
                                        // Fallback: fetch /toApproval for each request
                                        if (!aRequests.length) {
                                            resolve([]);
                                            return;
                                        }
                                        const aApprovalFetches = aRequests.map(request => {
                                            return new Promise((resolveReq) => {
                                                oModel.read(`/RequestSet(guid'${request.RequestId}')/toApproval`, {
                                                    success: function (oApprovalData) {
                                                        let aApprovals = [];
                                                        if (Array.isArray(oApprovalData.results)) {
                                                            aApprovals = oApprovalData.results;
                                                        } else if (oApprovalData.results) {
                                                            aApprovals = [oApprovalData.results];
                                                        }
                                                        // Filter by ApproverId and status
                                                        const aFiltered = aApprovals.filter(approval =>
                                                            approval.ApproverId === sLoggedInEmployeeId &&
                                                            (approval.Status === "" || approval.Status === "S")
                                                        );
                                                        resolveReq(aFiltered);
                                                    },
                                                    error: function () {
                                                        resolveReq([]);
                                                    }
                                                });
                                            });
                                        });
                                        Promise.all(aApprovalFetches).then(aAllApprovals => {
                                            resolve(aAllApprovals.flat());
                                        });
                                        return;
                                    }

                                    // Normal logic for models that support $expand
                                    const aFilteredApprovals = aRequests.filter(request => {
                                        const aApprovals = (request.toApproval && Array.isArray(request.toApproval.results)) ? request.toApproval.results : [];
                                        return aApprovals.some(approval =>
                                            approval.ApproverId === sLoggedInEmployeeId &&
                                            (approval.Status === "" || approval.Status === "S")
                                        );
                                    });
                                    resolve(aFilteredApprovals);
                                }.bind(this),
                                error: function () {
                                    resolve([]);
                                }
                            });
                        });
                    });

                    // My request count (expand for ALL models)
                    const aRequestPromises = aODataModels.map(oModel => {
                        return new Promise((resolve) => {
                            if (!oModel) {
                                resolve([]);
                                return;
                            }
                            oModel.read(sRequestPath, {
                                filters: [
                                    new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
                                ],
                                urlParameters: { "$expand": "toApproval" },
                                success: function (oRequestData) {
                                    const aFilteredRequests = (oRequestData.results || []).filter(request => {
                                        return request.PicNumber === sLoggedInEmployeeId;
                                    });
                                    resolve(aFilteredRequests);
                                },
                                error: function () {
                                    resolve([]);
                                }
                            });
                        });
                    });

                    Promise.all([Promise.all(aApprovalPromises), Promise.all(aRequestPromises)])
                        .then(([aApprovalResults, aRequestResults]) => {
                            const aCombinedApprovals = aApprovalResults.flat();
                            const oParamModel = this.getView().getModel("appParam");
                            if (oParamModel) {
                                oParamModel.setProperty("/approvalCount", aCombinedApprovals.length);
                            }
                            const aCombinedRequests = aRequestResults.flat();
                            if (oParamModel) {
                                oParamModel.setProperty("/myRequestCount", aCombinedRequests.length);
                            }
                            this._oBusy.close();
                        })
                        .catch(oError => {
                            console.error("Error combining data from all services:", oError);
                            sap.m.MessageBox.error("Failed to load data from all services.");
                            this._oBusy.close();
                        });
                })
                .catch(oError => {
                    console.error("Error retrieving current user:", oError);
                    sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
                    this._oBusy.close();
                });
        },

        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel(), // Movement (default)
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];
        //     console.log("OData Models:", aODataModels);

        //     const sEmployeePath = "/EmployeeSet";
        //     const sRequestPath = "/RequestSet";

        //     this._oBusy.open();

        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             if (!oCurrentUser || !oCurrentUser.EmployeeNumber) {
        //                 console.error("Invalid current user data:", oCurrentUser);
        //                 MessageBox.error("Failed to retrieve valid user details.");
        //                 this._oBusy.close();
        //                 return;
        //             }

        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);

        //             // Fetch EmployeeSet data for employeeCount
        //             const oDefaultModel = this.getOwnerComponent().getModel();
        //             if (!oDefaultModel) {
        //                 console.error("MOVEMENT MODEL NOT FOUND");
        //                 this._oBusy.close();
        //                 return;
        //             }

        //             oDefaultModel.read(sEmployeePath, {
        //                 urlParameters: { "$format": "json" },
        //                 success: function (oData) {
        //                     console.log("Employee Set loaded:", oData);

        //                     let oEmployeeModel = this.getView().getModel("employee");
        //                     if (!oEmployeeModel) {
        //                         oEmployeeModel = new sap.ui.model.json.JSONModel({ results: [] });
        //                         this.getView().setModel(oEmployeeModel, "employee");
        //                     }

        //                     oEmployeeModel.setProperty("/results", oData.results || oData);

        //                     const aSubordinates = oData.results.filter(employee => employee.Supervisor === sLoggedInEmployeeId);
        //                     console.log("Subordinates:", aSubordinates);

        //                     const oParamModel = this.getView().getModel("appParam");
        //                     if (oParamModel) {
        //                         oParamModel.setProperty("/employeeCount", aSubordinates.length);
        //                     } else {
        //                         console.error("appParam model not found for employeeCount");
        //                     }
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading Employee Set:", oError);
        //                 }.bind(this),
        //             });

        //             // Fetch data for /approvalCount
        //             const aApprovalPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]);
        //                         return;
        //                     }

        //                     // Special handling for Movement model (default)
        //                     if (oModel === this.getOwnerComponent().getModel()) {
        //                         // Fetch all requests first
        //                         oModel.read(sRequestPath, {
        //                             filters: [
        //                                 new sap.ui.model.Filter("ApproverId", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //                             ],
        //                             success: function (oRequestData) {
        //                                 const aRequests = oRequestData.results || [];
        //                                 if (aRequests.length === 0) {
        //                                     resolve([]);
        //                                     return;
        //                                 }
        //                                 // Fetch toApproval for each request
        //                                 const aApprovalFetches = aRequests.map(request => {
        //                                     return new Promise((resolveReq) => {
        //                                         oModel.read(`/RequestSet(guid'${request.RequestId}')/toApproval`, {
        //                                             success: function (oApprovalData) {
        //                                                 request.toApproval = oApprovalData;
        //                                                 resolveReq(request);
        //                                             },
        //                                             error: function () {
        //                                                 request.toApproval = { results: [] };
        //                                                 resolveReq(request);
        //                                             }
        //                                         });
        //                                     });
        //                                 });
        //                                 Promise.all(aApprovalFetches).then(aRequestsWithApprovals => {
        //                                     const aFilteredApprovals = aRequestsWithApprovals.filter(request => {
        //                                         const aApprovals = (request.toApproval && Array.isArray(request.toApproval.results)) ? request.toApproval.results : [];
        //                                         return aApprovals.some(approval =>
        //                                             approval.ApproverId === sLoggedInEmployeeId &&
        //                                             (approval.Status === "" || approval.Status === "S")
        //                                         );
        //                                     });
        //                                     resolve(aFilteredApprovals);
        //                                 });
        //                             },
        //                             error: function () {
        //                                 resolve([]);
        //                             }
        //                         });
        //                         return;
        //                     }

        //                     // Default logic for other models
        //                     oModel.read(sRequestPath, {
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             const aFilteredApprovals = oRequestData.results.filter(request => {
        //                                 const aApprovals = (request.toApproval && Array.isArray(request.toApproval.results)) ? request.toApproval.results : [];
        //                                 return aApprovals.some(approval =>
        //                                     approval.ApproverId === sLoggedInEmployeeId &&
        //                                     (approval.Status === "" || approval.Status === "S")
        //                                 );
        //                             });
        //                             resolve(aFilteredApprovals);
        //                         },
        //                         error: function () {
        //                             resolve([]);
        //                         }
        //                     });
        //                 });
        //             });

        //             // Fetch data for /myRequestCount
        //             const aRequestPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]);
        //                         return;
        //                     }

        //                     oModel.read(sRequestPath, {
        //                         filters: [
        //                             new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //                         ],
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             const aFilteredRequests = oRequestData.results.filter(request => {
        //                                 return request.PicNumber === sLoggedInEmployeeId;
        //                             });
        //                             resolve(aFilteredRequests);
        //                         },
        //                         error: function () {
        //                             resolve([]);
        //                         }
        //                     });
        //                 });
        //             });

        //             // Process all promises
        //             Promise.all([Promise.all(aApprovalPromises), Promise.all(aRequestPromises)])
        //                 .then(([aApprovalResults, aRequestResults]) => {
        //                     const aCombinedApprovals = aApprovalResults.flat();
        //                     console.log("Combined Approval Data:", aCombinedApprovals);

        //                     const oParamModel = this.getView().getModel("appParam");
        //                     if (oParamModel) {
        //                         oParamModel.setProperty("/approvalCount", aCombinedApprovals.length);
        //                     } else {
        //                         console.error("appParam model not found for approvalCount");
        //                     }

        //                     const aCombinedRequests = aRequestResults.flat();
        //                     console.log("Combined RequestSet Data:", aCombinedRequests);

        //                     if (oParamModel) {
        //                         oParamModel.setProperty("/myRequestCount", aCombinedRequests.length);
        //                     } else {
        //                         console.error("appParam model not found for myRequestCount");
        //                     }

        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        // fix but error approvalcount for movement model
        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];
        //     console.log("OData Models:", aODataModels);
        
        //     const sEmployeePath = "/EmployeeSet";
        //     const sRequestPath = "/RequestSet";
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             if (!oCurrentUser || !oCurrentUser.EmployeeNumber) {
        //                 console.error("Invalid current user data:", oCurrentUser);
        //                 MessageBox.error("Failed to retrieve valid user details.");
        //                 this._oBusy.close();
        //                 return;
        //             }
        
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             // Fetch EmployeeSet data for employeeCount
        //             const oDefaultModel = this.getOwnerComponent().getModel();
        //             if (!oDefaultModel) {
        //                 console.error("MOVEMENT MODEL NOT FOUND");
        //                 this._oBusy.close();
        //                 return;
        //             }
        
        //             oDefaultModel.read(sEmployeePath, {
        //                 urlParameters: { "$format": "json" },
        //                 success: function (oData) {
        //                     console.log("Employee Set loaded:", oData);
        
        //                     // Create the employee model
        //                     let oEmployeeModel = this.getView().getModel("employee");
        //                     if (!oEmployeeModel) {
        //                         oEmployeeModel = new sap.ui.model.json.JSONModel({ results: [] });
        //                         this.getView().setModel(oEmployeeModel, "employee");
        //                     }
        
        //                     // Set the data to the employee model
        //                     oEmployeeModel.setProperty("/results", oData.results || oData);
        
        //                     // Filter subordinates based on the logged-in user's EmployeeNumber
        //                     const aSubordinates = oData.results.filter(employee => employee.Supervisor === sLoggedInEmployeeId);
        //                     console.log("Subordinates:", aSubordinates);
        
        //                     // Update the appParam model with the subordinate count
        //                     const oParamModel = this.getView().getModel("appParam");
        //                     if (oParamModel) {
        //                         oParamModel.setProperty("/employeeCount", aSubordinates.length);
        //                     } else {
        //                         console.error("appParam model not found for employeeCount");
        //                     }
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error loading Employee Set:", oError);
        //                 }.bind(this),
        //             });
        
        //             // Fetch data for /approvalCount
        //             const aApprovalPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]); 
        //                         return;
        //                     }
        
        //                     oModel.read(sRequestPath, {
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded for approvalCount:", oRequestData);
        
        //                             // Filter approvals where ApproverId matches the logged-in user's EmployeeNumber
        //                             // and Status is empty
        //                             const aFilteredApprovals = oRequestData.results.filter(request => {
        //                                 return request.toApproval.results.some(approval => {
        //                                     return (
        //                                         approval.ApproverId === sLoggedInEmployeeId &&
        //                                         ( approval.Status === "" )
        //                                     );
        //                                 });
        //                             });
        
        //                             console.log("Filtered Approval Data (Status empty):", aFilteredApprovals);
        //                             resolve(aFilteredApprovals); // Resolve with the filtered approvals
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet for approvalCount:", oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             // Fetch data for /myRequestCount
        //             const aRequestPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]); // Resolve with an empty array if the model is not available
        //                         return;
        //                     }
        
        //                     oModel.read(sRequestPath, {
        //                         filters: [
        //                             new sap.ui.model.Filter("PicNumber", sap.ui.model.FilterOperator.EQ, sLoggedInEmployeeId)
        //                         ],
        //                         urlParameters: { "$expand": "toApproval" },
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded for myRequestCount:", oRequestData);
        
        //                             // Filter requests where PicNumber matches the logged-in user's EmployeeNumber
        //                             const aFilteredRequests = oRequestData.results.filter(request => {
        //                                 return request.PicNumber === sLoggedInEmployeeId;
        //                             });
        
        //                             console.log("Filtered Request Data (PicNumber matches):", aFilteredRequests);
        //                             resolve(aFilteredRequests); // Resolve with the filtered requests
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet for myRequestCount:", oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             // Process all promises
        //             Promise.all([Promise.all(aApprovalPromises), Promise.all(aRequestPromises)])
        //                 .then(([aApprovalResults, aRequestResults]) => {
        //                     // Combine results for /approvalCount
        //                     const aCombinedApprovals = aApprovalResults.flat();
        //                     console.log("Combined Approval Data:", aCombinedApprovals);
        
        //                     // Update the appParam model with the filtered approval count
        //                     const oParamModel = this.getView().getModel("appParam");
        //                     if (oParamModel) {
        //                         oParamModel.setProperty("/approvalCount", aCombinedApprovals.length);
        //                     } else {
        //                         console.error("appParam model not found for approvalCount");
        //                     }
        
        //                     // Combine results for /myRequestCount
        //                     const aCombinedRequests = aRequestResults.flat();
        //                     console.log("Combined RequestSet Data:", aCombinedRequests);
        
        //                     // Update the appParam model with the total request count
        //                     if (oParamModel) {
        //                         oParamModel.setProperty("/myRequestCount", aCombinedRequests.length);
        //                     } else {
        //                         console.error("appParam model not found for myRequestCount");
        //                     }
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        //fix approvalcount
        // _getInitialData: function () {
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel(),
        //         this.getOwnerComponent().getModel("Promotion"),
        //         this.getOwnerComponent().getModel("StatusChange"),
        //         this.getOwnerComponent().getModel("Assignment"),
        //         this.getOwnerComponent().getModel("Demotion"),
        //         this.getOwnerComponent().getModel("Acting"),
        //     ];
        
        //     const sRequestPath = "/RequestSet";
        
        //     this._oBusy.open();
        
        //     this._currentUser()
        //         .then(oCurrentUser => {
        //             if (!oCurrentUser || !oCurrentUser.EmployeeNumber) {
        //                 console.error("Invalid current user data:", oCurrentUser);
        //                 MessageBox.error("Failed to retrieve valid user details.");
        //                 this._oBusy.close();
        //                 return;
        //             }
        
        //             const sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        //             console.log("Logged-in Employee ID:", sLoggedInEmployeeId);
        
        //             const aPromises = aODataModels.map(oModel => {
        //                 return new Promise((resolve, reject) => {
        //                     if (!oModel) {
        //                         console.warn("OData model not available for one of the services.");
        //                         resolve([]); // Resolve with an empty array if the model is not available
        //                         return;
        //                     }
        
        //                     oModel.read(sRequestPath, {
        //                         urlParameters: { "$expand": "toApproval" }, // Expand toApproval
        //                         success: function (oRequestData) {
        //                             console.log("RequestSet loaded from service:", oRequestData);

        //                             const aFilteredApprovals = oRequestData.results.filter(request => {
        //                                 return request.toApproval.results.some(approval => {
        //                                     return (
        //                                         approval.ApproverId === sLoggedInEmployeeId &&
        //                                         (!approval.Status || approval.Status.trim() === "") 
        //                                     );
        //                                 });
        //                             });
        
        //                             console.log("Filtered Approval Data (Status empty and SequenceNumber matches):", aFilteredApprovals);
        //                             resolve(aFilteredApprovals); // Resolve with the filtered approvals
        //                         },
        //                         error: function (oError) {
        //                             console.error("Error loading RequestSet from service:", oError);
        //                             resolve([]); // Resolve with an empty array in case of an error
        //                         }
        //                     });
        //                 });
        //             });
        
        //             Promise.all(aPromises)
        //                 .then(aResults => {
        //                     const aCombinedResults = aResults.flat(); // Combine results from all services
        //                     console.log("Combined Filtered Approval Data:", aCombinedResults);
        
        //                     // Update the appParam model with the filtered approval count
        //                     const oParamModel = this.getView().getModel("appParam");
        //                     if (oParamModel) {
        //                         oParamModel.setProperty("/approvalCount", aCombinedResults.length);
        //                     } else {
        //                         console.error("appParam model not found");
        //                     }
        
        //                     // Optionally, set the filtered results to a model for further use
        //                     const oApprovalModel = new sap.ui.model.json.JSONModel({ items: aCombinedResults });
        //                     this.getView().setModel(oApprovalModel, "approvalModel");
        
        //                     this._oBusy.close();
        //                 })
        //                 .catch(oError => {
        //                     console.error("Error combining data from all services:", oError);
        //                     sap.m.MessageBox.error("Failed to load filtered approval data from all services.");
        //                     this._oBusy.close();
        //                 });
        //         })
        //         .catch(oError => {
        //             console.error("Error retrieving current user:", oError);
        //             sap.m.MessageBox.error("Failed to retrieve logged-in user details.");
        //             this._oBusy.close();
        //         });
        // },

        _currentUser: function () {
            return new Promise((resolve, reject) => {
                // Show busy indicator
                this._oBusy.open();
        
                const oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
                if (!oDataModel) {
                    console.error("OData model not available");
                    this._oBusy.close();
                    MessageBox.error("System error: OData model not available");
                    reject("OData model not available");
                    return;
                }
        
                // Call the EmployeeDetailSet endpoint to get logged-in user details
                oDataModel.read("/EmployeeDetailSet", {
                    success: function (oData) {
                        console.log("Current user data received:", oData);
        
                        if (!oData || !oData.results || oData.results.length === 0) {
                            this._oBusy.close();
                            MessageBox.error("No user data received from server");
                            reject("No user data received from server");
                            return;
                        }
        
                        // Get the first user from the results
                        const oCurrentUser = oData.results[0];
        
                        if (!oCurrentUser || !oCurrentUser.EmployeeNumber) {
                            console.error("Invalid user data received:", oCurrentUser);
                            this._oBusy.close();
                            MessageBox.error("Invalid user data received from server");
                            reject("Invalid user data received");
                            return;
                        }
        
                        // Create a model for current user details
                        const oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
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

        onSearch: function () {
            
        },

        onActReqPressed: function () {
            this.getRouter().navTo("orgchart");
        },

        onAppPressed: function () {
            this.getRouter().navTo("approval");
        },

        onHistoryPressed: function () {
            this.getRouter().navTo("history");
        },
        
        onNavBack: function () {
            this._navBack();
        },

        _navBack: function () {
            this._oView.setBindingContext(null);
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
    });
}
);