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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailApproval", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._currentUser();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailApprovalModel = new JSONModel();
            this.getView().setModel(this._oDetailApprovalModel, "detailApprovalModel");
            this.getRouter().getRoute("detailapproval").attachPatternMatched(this._onDetailApprovalRouteMatched, this);

            const oDropdownModel = new sap.ui.model.json.JSONModel({
                asColl: [
                    { key: "1", text: "Baru" },
                    { key: "2", text: "Pengganti" }
                ],
                salaryAdjColl : [
                    { key: "1", text: "Ya"},
                    { key: "2", text: "Tidak"}
                ]
            });
            this.getView().setModel(oDropdownModel, "dropdown");

            // Initialize verification model
            var oVerificationModel = new sap.ui.model.json.JSONModel({
                isAssessmentEnabled: false,
                isBiCheckingEnabled: false,
                isDisposisiEnabled: false,
                isSubmitVisible: false
            });
            this.getView().setModel(oVerificationModel, "verificationModel");

            // Get logged-in user's employee number and update the model
            this._setVerificationAccess();
        },

        _onDetailApprovalRouteMatched: function (oEvent) {
            var sRequestId = oEvent.getParameter("arguments").RequestId;
            if (this._isValidGuid(sRequestId)) {
                this._getDetailApprovalData(sRequestId);
                this.loadApprovalHistoryWithRequestor(sRequestId);
                this.loadSubmittedDocuments(sRequestId);
            } else {
                console.error("Invalid Request ID format");
                MessageBox.error("Invalid Request ID format");
            }

            this.loadApprovalHistory(sRequestId);
        },

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        _getDetailApprovalData: function (sRequestId) {
            var that = this;
            var oModel = this.getView().getModel();
            this._oBusy.open();
            
            // Retrieve data from RequestSet for the specific request
            oModel.read(`/RequestSet(guid'${sRequestId}')`, {
                success: function (oRequestData) {
                    console.log("RequestSet data retrieved successfully:", oRequestData);
        
                    // Retrieve data from EmployeeDetailSet for the specific employee
                    var sEmployeeNumber = oRequestData.EmployeeNumber;
                    oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
                        success: function (oEmployeeData) {
                            console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
                            // Combine data from RequestSet and EmployeeDetailSet
                            var oCombinedData = Object.assign({}, oRequestData, oEmployeeData);
        
                            // Set the combined data in the DetailHistoryModel
                            that._oDetailApprovalModel.setData(oCombinedData);
                            that._oBusy.close();
                        },
                        error: function (oError) {
                            console.error("Error retrieving EmployeeDetailSet data:", oError);
                            MessageBox.error("Failed to load employee data");
                            that._oBusy.close();
                        }
                    });
                },
                error: function (oError) {
                    console.error("Error retrieving RequestSet data:", oError);
                    MessageBox.error("Failed to load request data");
                    that._oBusy.close();
                }
            });
        },

        loadSubmittedDocuments: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot fetch documents.");
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel();
            const oView = this.getView();
        
            // Construct the path for FileAttachmentViewSet
            const sPath = `/FileAttachmentViewSet`;
        
            // Define filters for the RequestId
            const aFilters = [
                new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
            ];
        
            // Fetch documents from FileAttachmentViewSet
            oModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    console.log("Documents fetched successfully from FileAttachmentViewSet:", oData.results);
        
                    // Bind the data to the fileAttachment model
                    const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                    oView.setModel(oFileAttachmentModel, "fileAttachmentView");
                },
                error: function (oError) {
                    console.error("Error fetching documents from FileAttachmentViewSet:", oError);
                    MessageBox.error("Failed to fetch submitted documents.");
                }
            });
        },

        onShowDocument: function (oEvent) {
            // Get the binding context of the button
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("fileAttachmentView");
        
            // Get the URL from the binding context
            const sUrl = oContext.getProperty("Url");
        
            // Open the URL in a new tab
            if (sUrl) {
                window.open(sUrl, "_blank");
            } else {
                sap.m.MessageToast.show("No URL available for this document.");
            }
        },

        onApprovePress: function () {
            this._openApprovalDialog("approve");
        },

        onRejectPress: function () {
            this._openApprovalDialog("reject");
        },

        _openApprovalDialog: function (sAction) {
            if (!this._oApprovalDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ApprovalDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oApprovalDialog = oDialog;
                    this.getView().addDependent(this._oApprovalDialog);
                    this._oApprovalDialog.data("action", sAction);
                    this._oApprovalDialog.open();
                }.bind(this)); 
            } else {
                this._oApprovalDialog.data("action", sAction);
                this._oApprovalDialog.open();
            }
        },

        // onSubmitApproval: function () {
        //     var sAction = this._oApprovalDialog.data("action");
        //     var sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     var sRequestId = this._oDetailApprovalModel.getProperty("/RequestId");
        //     var sApproverId = "81000090"; // Replace with actual approver ID
        //     // Utility function to format date
        
        //     var oApprovalData = {
        //         RequestId: sRequestId,
        //         SequenceNumber: "001",
        //         ObjectType: "P",
        //         ApproverId: sApproverId,
        //         Abbreviation: "GRP",
        //         Status: sAction === "approve" ? "A" : "R",
        //         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //         ApprovalUser: sApproverId,
        //         Notes: sNotes
        //     };
        
        //     var oModel = this.getView().getModel();
        //     var sPath = `/RequestSet(guid'${sRequestId}')`;
        //     oModel.update(sPath, oApprovalData, {
        //         method: "POST",
        //         success: function () {
        //             MessageBox.success("Approval status saved successfully");
        //             this._oApprovalDialog.close();
        //         }.bind(this),
        //         error: function (oError) {
        //             console.error("Error saving approval status:", oError);
        //             MessageBox.error("Failed to save approval status");
        //         }
        //     });
        // },

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

        // onSubmitApproval: function () {
        //     var sAction = this._oApprovalDialog.data("action");
        //     var sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     var sRequestId = this._oDetailApprovalModel.getProperty("/RequestId");
        
        //     // Retrieve the logged-in user's ID
        //     this._currentUser()
        //         .then((oCurrentUser) => {
        //             var sLoggedInUserId = oCurrentUser.EmployeeNumber;
        
        //             // Fetch data from /toApproval for the specific RequestId
        //             var oModel = this.getView().getModel();
        //             var sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //             oModel.read(sToApprovalPath, {
        //                 success: function (oData) {
        //                     console.log("toApproval data retrieved successfully:", oData);
        
        //                     // Find the entry where ApproverId matches the logged-in user's ID
        //                     var oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
        //                     if (!oMatchedApproval) {
        //                         MessageBox.error("You are not authorized to approve this request.");
        //                         return;
        //                     }
        
        //                     // Prepare the payload for the update
        //                     var oApprovalData = {
        //                         SequenceNumber: oMatchedApproval.SequenceNumber,
        //                         ObjectType: oMatchedApproval.ObjectType,
        //                         ApproverId: oMatchedApproval.ApproverId,
        //                         Abbreviation: oMatchedApproval.Abbreviation,
        //                         Status: sAction === "approve" ? "A" : "R", // Set based on action
        //                         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                         ApprovalUser: sLoggedInUserId, // Logged-in user's ID
        //                         Notes: sNotes // Notes from the dialog
        //                     };
        
        //                     console.log("Payload for update:", oApprovalData);
        
        //                     // Path to the specific ApprovalSet entity
        //                     var sApprovalPath = `/ApprovalSet(RequestId=guid'${sRequestId}',SequenceNumber='${oMatchedApproval.SequenceNumber}')`;
        
        //                     // Use the update method to modify the existing entity
        //                     oModel.update(sApprovalPath, oApprovalData, {
        //                         method: "MERGE", // Use MERGE for partial updates
        //                         success: function () {
        //                             MessageBox.success("Approval status updated successfully");
        //                             this._oApprovalDialog.close();
        //                         }.bind(this),
        //                         error: function (oError) {
        //                             console.error("Error updating approval status:", oError);
        //                             MessageBox.error("Failed to update approval status");
        //                         }
        //                     });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving toApproval data:", oError);
        //                     MessageBox.error("Failed to load approval data");
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        // onSubmitApproval: function () {
        //     var sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     var sNotes = sap.ui.getCore().byId("approvalNotes").getValue(); // Notes from the dialog
        //     var sRequestId = this._oDetailApprovalModel.getProperty("/RequestId"); // Request ID
        
        //     // Retrieve the logged-in user's ID
        //     this._currentUser()
        //         .then((oCurrentUser) => {
        //             var sLoggedInUserId = oCurrentUser.EmployeeNumber;
        
        //             // Fetch data from /toApproval for the specific RequestId
        //             var oModel = this.getView().getModel();
        //             var sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //             oModel.read(sToApprovalPath, {
        //                 success: function (oData) {
        //                     console.log("toApproval data retrieved successfully:", oData);
        
        //                     // Find the entry where ApproverId matches the logged-in user's ID
        //                     var oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
        //                     if (!oMatchedApproval) {
        //                         MessageBox.error("You are not authorized to approve this request.");
        //                         return;
        //                     }
        
        //                     // Prepare the payload for the update
        //                     var oApprovalData = {
        //                         SequenceNumber: oMatchedApproval.SequenceNumber,
        //                         ObjectType: oMatchedApproval.ObjectType,
        //                         ApproverId: oMatchedApproval.ApproverId,
        //                         Abbreviation: oMatchedApproval.Abbreviation,
        //                         Status: sAction === "approve" ? "A" : "R", // Set based on action
        //                         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                         ApprovalUser: sLoggedInUserId, // Logged-in user's ID
        //                         Notes: sNotes // Notes from the dialog
        //                     };
        
        //                     console.log("Payload for update:", oApprovalData);
        
        //                     // Path to the specific ApprovalSet entity
        //                     var sPath = `/ApprovalSet(RequestId=guid'${sRequestId}',SequenceNumber='${oMatchedApproval.SequenceNumber}')`;
        
        //                     // Use the update method to modify the existing entity
        //                     oModel.update(sPath, oApprovalData, {
        //                         method: "MERGE", // Use MERGE for partial updates
        //                         success: function () {
        //                             MessageBox.success("Approval status updated successfully");
        //                             this._oApprovalDialog.close();
        //                         }.bind(this),
        //                         error: function (oError) {
        //                             console.error("Error updating approval status:", oError);
        //                             MessageBox.error("Failed to update approval status");
        //                         }
        //                     });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving toApproval data:", oError);
        //                     MessageBox.error("Failed to load approval data");
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            var oModel = this.getView().getModel(); // Get the OData model
            var sRequestPath = `/RequestSet(guid'${sRequestId}')`;
            var sToApprovalPath = `${sRequestPath}/toApproval`;
        
            // Show a busy indicator while loading data
            sap.ui.core.BusyIndicator.show(0);
        
            // Fetch data from /RequestSet
            oModel.read(sRequestPath, {
                success: function (oRequestData) {
                    console.log("RequestSet data retrieved successfully:", oRequestData);
        
                    // Fetch data from /EmployeeDetailSet to get FormattedName
                    var sEmployeePath = `/EmployeeDetailSet('${oRequestData.PicNumber}')`;
                    oModel.read(sEmployeePath, {
                        success: function (oEmployeeData) {
                            console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);

                            var sFormattedName = oEmployeeData.EmployeeName ? oEmployeeData.EmployeeName.FormattedName : "Unknown";
        
                            // Create a new entry for the requestor
                            var oRequestorEntry = {
                                ApproverId: oRequestData.PicNumber, // Use PicNumber as ApproverId
                                ApproverName: sFormattedName, // Use FormattedName from EmployeeDetailSet
                                ApprovalDate: oRequestData.CreatedOn, // Use CreatedOn as ApprovalDate
                                ApprovalTime: oRequestData.CreatedAt, // Use CreatedAt as ApprovalTime
                                Status: "Submitted", // Default status
                                StatusText: "Submitted", // Default status text
                                Notes: "" // No notes for the requestor
                            };
                            console.log("FormattedName for requestor:", sFormattedName);
        
                            // Fetch data from /toApproval
                            oModel.read(sToApprovalPath, {
                                success: function (oApprovalData) {
                                    console.log("toApproval data retrieved successfully:", oApprovalData);
        
                                    // Combine the requestor entry with the approval history
                                    var aApprovalHistory = [oRequestorEntry].concat(oApprovalData.results);
        
                                    // Create a JSON model for the approval history
                                    var oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalHistory });
        
                                    // Bind the data to the table
                                    this.getView().byId("idApprTable").setModel(oApprovalHistoryModel, "appr");
        
                                    // Hide the busy indicator
                                    sap.ui.core.BusyIndicator.hide();
                                }.bind(this),
                                error: function (oError) {
                                    console.error("Error retrieving approval history data:", oError);
                                    MessageBox.error("Failed to load approval history.");
                                    sap.ui.core.BusyIndicator.hide();
                                }
                            });
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error retrieving employee data:", oError);
                            MessageBox.error("Failed to load employee details.");
                            sap.ui.core.BusyIndicator.hide();
                        }
                    });
                }.bind(this),
                error: function (oError) {
                    console.error("Error retrieving request data:", oError);
                    MessageBox.error("Failed to load request data.");
                    sap.ui.core.BusyIndicator.hide();
                }
            });
        },

        // loadApprovalHistoryWithRequestor: function (sRequestId) {
        //     var oModel = this.getView().getModel(); // Get the OData model
        //     var sRequestPath = `/RequestSet(guid'${sRequestId}')`;
        //     var sToApprovalPath = `${sRequestPath}/toApproval`;
        
        //     // Show a busy indicator while loading data
        //     sap.ui.core.BusyIndicator.show(0);
        
        //     // Fetch data from /RequestSet
        //     oModel.read(sRequestPath, {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully:", oRequestData);
        
        //             // Create a new entry for the requestor
        //             var oRequestorEntry = {
        //                 ApproverId: oRequestData.PicNumber, // Use PicNumber as ApproverId
        //                 ApproverName: oRequestData.PicName, // Use PicName if available
        //                 ApprovalDate: oRequestData.CreatedOn, // Use CreatedOn as ApprovalDate
        //                 ApprovalTime: oRequestData.CreatedAt, // Use CreatedAt as ApprovalTime
        //                 Status: "Submitted", // Default status
        //                 StatusText: "Submitted", // Default status text
        //                 Notes: "" // No notes for the requestor
        //             };
        
        //             // Fetch data from /toApproval
        //             oModel.read(sToApprovalPath, {
        //                 success: function (oApprovalData) {
        //                     console.log("toApproval data retrieved successfully:", oApprovalData);
        
        //                     // Combine the requestor entry with the approval history
        //                     var aApprovalHistory = [oRequestorEntry].concat(oApprovalData.results);
        
        //                     // Create a JSON model for the approval history
        //                     var oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalHistory });
        
        //                     // Bind the data to the table
        //                     this.getView().byId("idApprTable").setModel(oApprovalHistoryModel, "appr");
        
        //                     // Hide the busy indicator
        //                     sap.ui.core.BusyIndicator.hide();
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving approval history data:", oError);
        //                     MessageBox.error("Failed to load approval history.");
        //                     sap.ui.core.BusyIndicator.hide();
        //                 }
        //             });
        //         }.bind(this),
        //         error: function (oError) {
        //             console.error("Error retrieving request data:", oError);
        //             MessageBox.error("Failed to load request data.");
        //             sap.ui.core.BusyIndicator.hide();
        //         }
        //     });
        // },

        // loadApprovalHistory: function (sRequestId) {
        //     var oModel = this.getView().getModel(); // Get the OData model
        //     var sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //     // Show a busy indicator while loading data
        //     sap.ui.core.BusyIndicator.show(0);
        
        //     // Fetch data from /toApproval
        //     oModel.read(sToApprovalPath, {
        //         success: function (oData) {
        //             console.log("Approval history data retrieved successfully:", oData);
        
        //             // Create a JSON model for the approval history
        //             var oApprovalHistoryModel = new sap.ui.model.json.JSONModel(oData);
        
        //             // Bind the data to the table
        //             this.getView().byId("idApprTable").setModel(oApprovalHistoryModel, "appr");
        
        //             // Hide the busy indicator
        //             sap.ui.core.BusyIndicator.hide();
        //         }.bind(this),
        //         error: function (oError) {
        //             console.error("Error retrieving approval history data:", oError);
        //             MessageBox.error("Failed to load approval history.");
        //             sap.ui.core.BusyIndicator.hide();
        //         }
        //     });
        // },

        formatApprovalTime: function (sApprovalTime) {
            if (!sApprovalTime) {
                return ""; // Return empty if no value
            }
        
            // Check if ApprovalTime is an object with the `ms` property
            if (typeof sApprovalTime === "object" && sApprovalTime.ms !== undefined) {
                var iMilliseconds = sApprovalTime.ms; // Get the milliseconds value
                var oDate = new Date(iMilliseconds); // Create a Date object from milliseconds
        
                // Extract hours and minutes
                var sHours = String(oDate.getUTCHours()).padStart(2, "0"); // Ensure 2-digit hours
                var sMinutes = String(oDate.getUTCMinutes()).padStart(2, "0"); // Ensure 2-digit minutes
        
                return `${sHours}:${sMinutes}`; // Return formatted time (HH:mm)
            }
        
            // If ApprovalTime is not an object, return it as-is
            return sApprovalTime;
        },

        _createApprovalDateTime: function () {
            var oDate = new Date();
        
            // Format the date as YYYY-MM-DDTHH:mm:ss (ISO 8601 format)
            var sApprovalDate = oDate.toISOString().split(".")[0]; // Remove milliseconds
        
            // Format the time as PTxxHxxMxxS (ISO 8601 duration format)
            var sApprovalTime = `PT${oDate.getHours()}H${oDate.getMinutes()}M${oDate.getSeconds()}S`;
        
            return {
                ApprovalDate: sApprovalDate,
                ApprovalTime: sApprovalTime
            };
        },

        onSubmitApproval: function () {
            var sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
            var sNotes = sap.ui.getCore().byId("approvalNotes").getValue(); // Notes from the dialog
            var sRequestId = this._oDetailApprovalModel.getProperty("/RequestId"); // Request ID
        
            // Retrieve the logged-in user's ID
            this._currentUser()
                .then((oCurrentUser) => {
                    var sLoggedInUserId = oCurrentUser.EmployeeNumber;
        
                    // Fetch data from /toApproval for the specific RequestId
                    var oModel = this.getView().getModel();
                    var sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
                    oModel.read(sToApprovalPath, {
                        success: function (oData) {
                            console.log("toApproval data retrieved successfully:", oData);
        
                            // Find the entry where ApproverId matches the logged-in user's ID
                            var oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
                            if (!oMatchedApproval) {
                                MessageBox.error("You are not authorized to approve this request.");
                                return;
                            }

                            var oDateTime = this._createApprovalDateTime();
        
                            // Prepare the payload for the update
                            var oApprovalData = {
                                SequenceNumber: oMatchedApproval.SequenceNumber,
                                ObjectType: oMatchedApproval.ObjectType,
                                ApproverId: oMatchedApproval.ApproverId,
                                Abbreviation: oMatchedApproval.Abbreviation,
                                Status: sAction === "approve" ? "A" : "R", 
                                StatusText: sAction === "approve" ? "Approved" : "Rejected",
                                ApprovalUser: sLoggedInUserId, 
                                Notes: sNotes, 
                                ApprovalDate: oDateTime.ApprovalDate, 
                                ApprovalTime: oDateTime.ApprovalTime
                            };
        
                            console.log("Payload for update:", oApprovalData);
        
                            // Path to the specific RequestSet entity
                            var sPath = `/RequestSet(guid'${sRequestId}')`;
        
                            // Use the update method to modify the existing entity
                            oModel.update(sPath, oApprovalData, {
                                method: "MERGE", // Use MERGE for partial updates
                                success: function () {
                                    MessageBox.success("Approval status updated successfully");
                                    this._oApprovalDialog.close();
                                }.bind(this),
                                error: function (oError) {
                                    console.error("Error updating approval status:", oError);
                                    MessageBox.error("Failed to update approval status");
                                }
                            });
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error retrieving toApproval data:", oError);
                            MessageBox.error("Failed to load approval data");
                        }
                    });
                })
                .catch((error) => {
                    console.error("Error retrieving current user:", error);
                    MessageBox.error("Failed to retrieve logged-in user details.");
                });
        },

        onSendRequest: function () {
            let oCurrentUserModel = this.getView().getModel("currentUser");
            let sLoggedInEmployeeId = oCurrentUserModel ? oCurrentUserModel.getProperty("/EmployeeNumber") : null;

            if (!sLoggedInEmployeeId) {
                MessageBox.error("Unable to retrieve logged-in user details.");
                return;
            }

            if (!this._validateEntries(this.getView(), "grpValidation")) {
                return;
            }

            MessageBox.confirm("Do you want to submit this request?", {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        this._postRequest(sLoggedInEmployeeId);
                    }
                }
            });
        },

        // onSendRequest: function () {
        //     // Get the logged-in user's employee number
        //     let oCurrentUserModel = this.getView().getModel("currentUser");
        //     let sLoggedInEmployeeId = oCurrentUserModel ? oCurrentUserModel.getProperty("/EmployeeNumber") : null;
        
        //     if (!sLoggedInEmployeeId) {
        //         MessageBox.error("Unable to retrieve logged-in user details.");
        //         return;
        //     }
        
        //     // Validate required entries
        //     if (!this._validateEntries(this.getView(), "grpValidation")) {
        //         return;
        //     }
        
        //     // Confirm with the user before submission
        //     MessageBox.confirm("Do you want to submit this request?", {
        //         actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        //         emphasizedAction: MessageBox.Action.YES,
        //         onClose: (sAction) => {
        //             if (sAction === MessageBox.Action.YES) {
        //                 this._postRequest(sLoggedInEmployeeId);
        //             }
        //         }
        //     });
        // },

        _postRequest: function (sLoggedInEmployeeId) {
            // Determine the role of the logged-in user
            let oPayload = {
                RequestId: "00000000-0000-0000-0000-000000000000",
                EmployeeNumber: this.getView().getModel("employee").getProperty("/EmployeeNumber"),
                Status: "S",
                PicNumber: sLoggedInEmployeeId
            };
        
            if (sLoggedInEmployeeId === "81000081") {
                // Verificator 1 (Talent Management)
                oPayload.Zverify = this.byId("verifyResultMutation").getSelected() ? "1" : "";
                oPayload.ZrekomHcm = this.byId("rekomendasiHCMMutation").getValue();
            } else if (sLoggedInEmployeeId === "81000061") {
                // Verificator 2 (Compensation Benefit)
                const checkboxIds = ["hasilMutation1", "hasilMutation2", "hasilMutation3", "hasilMutation4", "hasilMutation5"];
                oPayload.Zbichecking = checkboxIds
                    .map(id => this.byId(id))
                    .filter(checkbox => checkbox && checkbox.getSelected())
                    .map(checkbox => checkbox.getText())
                    .join(",");
                oPayload.Znotebicheck = this.byId("hasilBiCheckingMutation").getValue();
            }
        
            // Common fields for both roles
            oPayload.Zdisposisi = (parseInt(this.getView().getModel("disposisiMutation").getProperty("/selectedIndex")) + 1).toString();
            oPayload.Znotedisp = this.byId("dispoNoteMutation").getValue();
            oPayload.Zsalaryfnl = this.byId("gajiMutation").getValue() ? this.byId("gajiMutation").getValue().replace(/\D/g, '') : "0";
        
            console.log("Payload for submission:", oPayload);
        
            // Submit the data
            let oModel = this.getOwnerComponent().getModel();
            oModel.create("/RequestSet", oPayload, {
                success: (oData) => {
                    MessageBox.success("Request submitted successfully.");
                    this.onSubmitFiles(oData.RequestId);
                },
                error: (oError) => {
                    console.error("Error submitting request:", oError);
                    MessageBox.error("Failed to submit the request.");
                }
            });
        },

        onSubmitFiles: function (sRequestId) {
            const oFileAttachmentModel = this.getView().getModel("fileAttachment");
            const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        
            if (!aFiles || aFiles.length === 0) {
                MessageBox.warning("No files to upload.");
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel();
            aFiles.forEach((oFile, index) => {
                const oPayload = {
                    Reqid: sRequestId,
                    Seqnr: index.toString(),
                    FileName: oFile.FileName,
                    FileType: oFile.FileType,
                    FileSize: oFile.FileSize,
                    Attachment: oFile.Attachment
                };
        
                oModel.create("/FileAttachmentSet", oPayload, {
                    success: () => {
                        console.log("File uploaded successfully:", oFile.FileName);
                    },
                    error: (oError) => {
                        console.error("Error uploading file:", oError);
                        MessageBox.error("Failed to upload file: " + oFile.FileName);
                    }
                });
            });
        },

        _setVerificationAccess: function () {
            var oUserInfoService = sap.ushell.Container.getService("UserInfo");
            var sLoggedInEmployeeNumber = oUserInfoService.getUser().getId(); // Get logged-in user's employee number
        
            var oVerificationModel = this.getView().getModel("verificationModel");
        
            // Set access based on employee number
            if (sLoggedInEmployeeNumber === "81000081") {
                // Verificator 1 (Talent Management)
                oVerificationModel.setProperty("/isAssessmentEnabled", true);
                oVerificationModel.setProperty("/isBiCheckingEnabled", false);
                oVerificationModel.setProperty("/isDisposisiEnabled", false);
                oVerificationModel.setProperty("/isSubmitVisible", true);
            } else if (sLoggedInEmployeeNumber === "81000061") {
                // Verificator 2 (Compensation Benefit)
                oVerificationModel.setProperty("/isAssessmentEnabled", false);
                oVerificationModel.setProperty("/isBiCheckingEnabled", true);
                oVerificationModel.setProperty("/isDisposisiEnabled", false);
                oVerificationModel.setProperty("/isSubmitVisible", true);
            } else {
                // Approval roles (Approval 1, 2, 3)
                oVerificationModel.setProperty("/isAssessmentEnabled", false);
                oVerificationModel.setProperty("/isBiCheckingEnabled", false);
                oVerificationModel.setProperty("/isDisposisiEnabled", false);
                oVerificationModel.setProperty("/isSubmitVisible", false);
            }
        },

        onCancelApproval: function () {
            this._oApprovalDialog.close();
        },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("approval", {}, true);
            }
        }

    });
});