sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "sap/ui/model/json/JSONModel"
  ], (Controller, J) => {
    "use strict";
  
    return Controller.extend("bsim.hcmapp.man.movement.controller.App", {
        onInit: function() {
          this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
          let oParamModel = new J({
            employeeCount: 0,
            requestCount: 0
          });
          this.setModel(oParamModel, "appParam");

          this.setModel(new J(), "employee");
          this.setModel(new J(), "fileAttachment");

          let oSubGroupModel = new J({
              selectedSubGroup: {},
              items: [] 
          });
          this.getOwnerComponent().setModel(oSubGroupModel, "subGroup");

          let oSubAreaModel = new J({
            selectedSubArea: {},
            items: [] 
          });
          this.getOwnerComponent().setModel(oSubAreaModel, "subArea");
        }
    });
  });